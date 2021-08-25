// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "hardhat/console.sol";

interface IIlluvium {
    struct Deposit {
        uint tokenAmount;
        uint weight;
        uint64 lockedFrom;
        uint64 lockedUntil;
        bool isYield;
    }
    function stake(uint amount, uint64 lockUntil, bool useSILV) external;
    function unstake(uint depositId, uint amount, bool useSILV) external;
    function processRewards(bool useSILV) external;
    function balanceOf(address) external view returns (uint);
    function pendingYieldRewards(address) external view returns (uint);
    function getDeposit(address, uint) external view returns (Deposit memory);
    function getDepositsLength(address) external view returns (uint);
}

interface IWETH is IERC20Upgradeable {
    function withdraw(uint amount) external;
}

interface IRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);

    function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts);
}

interface IPair is IERC20Upgradeable {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

interface IChainlink {
    function latestAnswer() external view returns (int256);
}

contract ILVETHVault is Initializable, ERC20Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeERC20Upgradeable for IWETH;
    using SafeERC20Upgradeable for IPair;

    IERC20Upgradeable constant ILV = IERC20Upgradeable(0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E);
    IERC20Upgradeable constant sILV = IERC20Upgradeable(0x398AeA1c9ceb7dE800284bb399A15e0Efe5A9EC2);
    IPair constant ILVETH = IPair(0x6a091a3406E0073C3CD6340122143009aDac0EDa);
    IWETH constant WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2) ;
    IIlluvium constant ilvEthPool = IIlluvium(0x8B4d8443a0229349A9892D4F7CbE89eF5f843F72);
    IIlluvium constant ilvPool = IIlluvium(0x25121EDDf746c884ddE4619b573A7B10714E2a36);
    IRouter constant sushiRouter = IRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);

    uint public vestedILV;
    uint public availableID;
    mapping(address => bool) public isWhitelisted;
    mapping(address => uint) private depositedBlock;
    uint public fees;

    address public admin;
    address public treasuryWallet;
    address public communityWallet;
    address public strategist;

    event Deposit(address indexed caller, uint amtDeposited, uint sharesMinted);
    event Withdraw(address indexed caller, uint amtWithdrawed, uint sharesBurned);
    event Invest(uint amtInvested);
    event TransferredOutFees(uint fees);
    event Harvest(uint amtHarvestedVestedILV);
    event Unlock(uint amtUnlockedILV);
    event Compound(uint amtTokenCompounded);
    event EmergencyWithdraw(uint amtTokenWithdrawed);
    event SetWhitelistAddress(address indexed _address, bool indexed status);
    event SetTreasuryWallet(address indexed treasuryWallet);
    event SetCommunityWallet(address indexed communityWallet);
    event SetAdminWallet(address indexed admin);
    event SetStrategistWallet(address indexed strategistWallet);

    modifier onlyOwnerOrAdmin {
        require(msg.sender == owner() || msg.sender == address(admin), "Only owner or admin");
        _;
    }

    function initialize(string calldata name, string calldata ticker) external initializer {
        // __ERC20_init("DAO L1 Sushi ILV-ETH", "daoSushiILV");
        __ERC20_init(name, ticker);
        __Ownable_init();

        ILV.safeApprove(address(sushiRouter), type(uint).max);
        WETH.safeApprove(address(sushiRouter), type(uint).max);
        ILVETH.safeApprove(address(ilvEthPool), type(uint).max);
    }

    function deposit(uint amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must > 0");
        uint amtDeposit = amount;

        uint pool = getAllPool();
        ILVETH.safeTransferFrom(msg.sender, address(this), amount);
        depositedBlock[msg.sender] = block.number;

        if (!isWhitelisted[msg.sender]) {
            uint fee = amount * 1 / 10;
            amount = amount - fee;
            fees = fees + fee;
        }

        uint _totalSupply = totalSupply();
        uint share = _totalSupply == 0 ? amount : amount * _totalSupply / pool;
        _mint(msg.sender, share);
        emit Deposit(msg.sender, amtDeposit, share);
    }

    function withdraw(uint share) external nonReentrant returns (uint withdrawAmt) {
        require(share > 0, "Share must > 0");
        require(share <= balanceOf(msg.sender), "Not enough shares to withdraw");
        require(depositedBlock[msg.sender] != block.number);

        uint ILVETHBal = ILVETH.balanceOf(address(this));
        uint ILVETHAmt = ilvEthPool.balanceOf(address(this)) + ILVETHBal;
        withdrawAmt = ILVETHAmt * share / totalSupply();
        _burn(msg.sender, share);

        uint availableILVETH = ILVETHBal;
        uint _availableID = availableID;
        while (availableILVETH < withdrawAmt) {
            IIlluvium.Deposit memory _deposit = ilvEthPool.getDeposit(address(this), _availableID);
            ilvEthPool.unstake(_availableID, _deposit.tokenAmount, false);
            _availableID = _availableID + 1;
            availableILVETH = availableILVETH + _deposit.tokenAmount;
        }
        availableID = _availableID;

        ILVETH.safeTransfer(msg.sender, withdrawAmt);
        emit Withdraw(msg.sender, withdrawAmt, share);
    }

    function invest() public onlyOwnerOrAdmin whenNotPaused {
        if (fees > 0) {
            uint fee = fees * 2 / 5; // 40%
            ILVETH.safeTransfer(treasuryWallet, fee);
            ILVETH.safeTransfer(communityWallet, fee);
            ILVETH.safeTransfer(strategist, fees - fee - fee);
            emit TransferredOutFees(fees);
        }

        uint _vestedILV = ilvEthPool.pendingYieldRewards(address(this));
        vestedILV = vestedILV + _vestedILV;
        uint ILVETHAmt = ILVETH.balanceOf(address(this));
        ilvEthPool.stake(ILVETHAmt, 0, false);

        emit Invest(ILVETHAmt);
    }

    function harvest() external {
        uint _vestedILV = ilvEthPool.pendingYieldRewards(address(this));
        ilvEthPool.processRewards(false);
        vestedILV = vestedILV + _vestedILV;
        emit Harvest(_vestedILV);
    }

    function unlock(uint index) external {
        IIlluvium.Deposit memory _deposit = ilvPool.getDeposit(address(this), index);
        vestedILV = vestedILV - _deposit.tokenAmount;
        ilvPool.unstake(index, _deposit.tokenAmount, false);
        emit Unlock(_deposit.tokenAmount);
    }

    function compound() external whenNotPaused {
        uint ILVAmtHalf = ILV.balanceOf(address(this)) / 2;
        uint WETHAmt = (sushiRouter.swapExactTokensForTokens(ILVAmtHalf, 0, getPath(address(ILV), address(WETH)), address(this), block.timestamp))[1];
        (,, uint lpTokenAmt) = sushiRouter.addLiquidity(address(ILV), address(WETH), ILVAmtHalf, WETHAmt, 0, 0, address(this), block.timestamp);
        ilvEthPool.stake(lpTokenAmt, 0, false);
        emit Compound(lpTokenAmt);
    }

    /// @dev unlock all available ILV first before call this function
    function emergencyWithdraw() external onlyOwnerOrAdmin {
        _pause();

        // Withdraw all ILVETH
        uint ilvEthDepositsLength = ilvEthPool.getDepositsLength(address(this));
        for (uint i = availableID; i < ilvEthDepositsLength; i ++) {
            IIlluvium.Deposit memory _deposit = ilvEthPool.getDeposit(address(this), i);
            ilvEthPool.unstake(i, _deposit.tokenAmount, false);
        }
        availableID = ilvEthDepositsLength - 1;

        // Convert available ILV to ILVETH
        uint ILVAmtHalf = ILV.balanceOf(address(this)) / 2;
        uint WETHAmt = (sushiRouter.swapExactTokensForTokens(ILVAmtHalf, 0, getPath(address(ILV), address(WETH)), address(this), block.timestamp))[1];
        sushiRouter.addLiquidity(address(ILV), address(WETH), ILVAmtHalf, WETHAmt, 0, 0, address(this), block.timestamp);

        emit EmergencyWithdraw(ILVETH.balanceOf(address(this)));
    }

    function reinvest() external onlyOwnerOrAdmin whenPaused {
        _unpause();
        invest();
    }

    function setWhitelistAddress(address addr, bool status) external onlyOwnerOrAdmin {
        isWhitelisted[addr] = status;
        emit SetWhitelistAddress(addr, status);
    }

    function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
        treasuryWallet = _treasuryWallet;
        emit SetTreasuryWallet(_treasuryWallet);
    }

    function setCommunityWallet(address _communityWallet) external onlyOwner {
        communityWallet = _communityWallet;
        emit SetCommunityWallet(_communityWallet);
    }

    function setAdmin(address _admin) external onlyOwner {
        admin = _admin;
        emit SetAdminWallet(_admin);
    }

    function setStrategist(address _strategist) external {
        require(msg.sender == strategist || msg.sender == owner(), "Only owner or strategist");
        strategist = _strategist;
        emit SetStrategistWallet(_strategist);
    }

    function getPath(address tokenA, address tokenB) private pure returns (address[] memory path) {
        path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
    }

    function getDepositsLength() public view returns (uint) {
        return ilvPool.getDepositsLength(address(this));
    }

    function getVestedInfo(uint i) external view returns (IIlluvium.Deposit memory _deposit) {
        _deposit = ilvPool.getDeposit(address(this), i);
    }

    function getPendingRewards() external view returns (uint) {
        return ilvEthPool.pendingYieldRewards(address(this));
    }

    function getTotalILVETH() private view returns (uint) {
        return ILVETH.balanceOf(address(this)) + ilvEthPool.balanceOf(address(this));
    }

    function getILVETHPrice() private view returns (uint) {
        uint ILVPriceInETH = (sushiRouter.getAmountsOut(1e18, getPath(address(ILV), address(WETH))))[1];
        (uint112 reserveILV, uint112 reserveWETH,) = ILVETH.getReserves();
        uint totalReserveInETH = reserveILV * ILVPriceInETH / 1e18 + reserveWETH;
        return totalReserveInETH * 1e18 / ILVETH.totalSupply();
    }

    function getILVETHPriceInUSD() private view returns (uint) {
        uint ETHPriceInUSD = uint(IChainlink(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419).latestAnswer()); // 8 decimals
        return getILVETHPrice() * ETHPriceInUSD / 1e8;
    }

    /// @return Total amount of ILV-ETH under this contract, include vested ILV (calculate in ILV-ETH)
    function getAllPool() public view returns (uint) {
        uint ILVPriceInETH = (sushiRouter.getAmountsOut(1e18, getPath(address(ILV), address(WETH))))[1];
        (uint112 reserveILV, uint112 reserveWETH,) = ILVETH.getReserves();
        uint totalReserveInETH = reserveILV * ILVPriceInETH / 1e18 + reserveWETH;
        uint ILVETHPriceInETH = totalReserveInETH * 1e18 / ILVETH.totalSupply();

        uint ILVETHPerILV = ILVETHPriceInETH * 1e18 / ILVPriceInETH;
        uint vestedILVAmtInILVETH = ILVETHPerILV * vestedILV / 1e18;

        return getTotalILVETH() + vestedILVAmtInILVETH;
    }

    function getAllPoolInETH() public view returns (uint) {
        return getAllPool() * getILVETHPrice() / 1e18;
    }

    function getAllPoolInUSD() public view returns (uint) {
        return getAllPool() * getILVETHPriceInUSD() / 1e18;
    }

    /// @return Total amount of ILV-ETH in ETH under this contract, NOT include vested ILV
    function getAllPoolInETHExcludeVestedILV() external view returns (uint) {
        return getTotalILVETH() * getILVETHPrice() / 1e18;
    }

    /// @param inUSD true for calculate user share in USD, false for calculate APR
    function getPricePerFullShare(bool inUSD) external view returns (uint) {
        uint _totalSupply = totalSupply();
        if (_totalSupply == 0) return 0;
        return inUSD == true ?
            getAllPoolInUSD() * 1e18 / _totalSupply :
            getAllPool() * 1e18 / _totalSupply;
    }
}