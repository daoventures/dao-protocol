// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "hardhat/console.sol";

/**
 * New strategy contract must utilize ERC20 and with functions below:
 *
 * In constructor, _setupDecimals(decimals) follow token decimals
 *
 * function deposit(uint256 _amount)
 * -> require msg.sender == Vault
 *
 * function withdraw(uint256 _amount)
 * -> require msg.sender == Vault
 *
 * function refund(uint256 _shares)
 * -> Receive amount of shares (same amount with daoToken) as argument
 * -> require msg.sender == Vault
 *
 * function approveMigrate()
 * -> Approve Vault to migrate all funds to new strategy
 */
interface IStrategy{
    function deposit(uint _amount, IERC20 _token) external ;
    function harvest() external;
    function withdraw(uint _amount, IERC20 _token) external;
    function getValueInPool() external view returns (uint);
    function migrateFunds(IERC20 _withdrawnToken) external ;
    function setAdmin(address _newAdmin)external ;
    function setVault(address _vault) external ;
}

/// @title Contract to interact between user and strategy, and distribute daoToken
contract moneyPrinterVault is ERC20, Ownable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    IERC20 public token;
    IERC20 DAI = IERC20(0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063); 
    IERC20 USDC = IERC20(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174);
    IERC20 USDT = IERC20(0xc2132D05D31c914a87C6611C10748AEb04B58e8F);

    IStrategy public strategy;
    address public pendingStrategy;
    address public admin;
    address public treasuryWallet = 0x986a2fCa9eDa0e06fBf7839B89BfC006eE2a23Dd; //TODO change address
    address public communityWallet = 0x986a2fCa9eDa0e06fBf7839B89BfC006eE2a23Dd;
    address public strategist = 0x986a2fCa9eDa0e06fBf7839B89BfC006eE2a23Dd;

    bool public canSetPendingStrategy = true;
    uint256 public unlockTime;
    uint256 public constant LOCKTIME = 2 days;
    uint256[] public networkFeeTier2 = [50000*1e18+1, 100000*1e18];
    uint256 public customNetworkFeeTier = 1000000*1e18;
    uint256[] public networkFeePerc = [100, 75, 50];
    uint256 public customNetworkFeePerc = 25;
    uint256 public profitSharingFeePerc = 2000;

    mapping(address => uint) public depositedAmount;


    event Deposit(address indexed from, address indexed token, uint amount, uint sharesMinted);
    event Withdraw(address indexed from, address indexed token, uint amount, uint sharesBurned);
    event MigrateFunds(address indexed fromStrategy, address indexed newStrategy, uint amount);
    event SetAdmin(address oldAdmin, address newAdmin);
    event SetCommunityWallet(address oldCommunityWallet, address newCommunityWallet);
    event SetTreasuryWallet(address oldTreasury, address newTreasury);
    event SetPendingStrategy(address oldStrategy, address newStrategy);
    event Harvest(uint timestamp);


    constructor(address _strategy, address _admin)
        ERC20("DAO Vault Money Printer", "daoMPT")
    {
        // token = IERC20(_token);
        _setupDecimals(18);
        strategy = IStrategy(_strategy);
        admin = _admin; 

        DAI.safeApprove(_strategy, type(uint).max);
        USDC.safeApprove(_strategy, type(uint).max);
        USDT.safeApprove(_strategy, type(uint).max);
    }

    /**
     * @notice Deposit into strategy
     * @param _amount amount to deposit
     * Requirements:
     * - Only EOA account can call this function
     */
    function deposit(uint256 _amount, IERC20 _token) external {
        require(msg.sender == tx.origin, "Only EOA");
        require(_amount > 0, "Invalid amount");
        uint256 shares;
        uint feeAmount;
        uint _amountAfterFee;
        if (_token == DAI) {
            (_amountAfterFee, feeAmount) = _calcSharesAfterNetworkFee(_amount);

            shares = totalSupply() == 0
                ? _amountAfterFee
                : _amountAfterFee.mul(totalSupply()).div(getValueInPool());

            DAI.safeTransferFrom(msg.sender, address(this), _amount);

        } else if (_token == USDC) {
            uint _amountMagnified = _amount.mul(1e12);
            (_amountAfterFee, feeAmount) = _calcSharesAfterNetworkFee(_amountMagnified);

            shares = totalSupply() == 0
                ? _amountAfterFee
                : _amountAfterFee.mul(totalSupply()).div(
                    getValueInPool());

            USDC.safeTransferFrom(msg.sender, address(this), _amount);
            feeAmount = feeAmount.div(1e12);
        } else if (_token == USDT) {
            uint _amountMagnified = _amount.mul(1e12);
            (_amountAfterFee, feeAmount) = _calcSharesAfterNetworkFee(_amountMagnified);

            shares = totalSupply() == 0
                ? _amountAfterFee
                : _amountAfterFee.mul(totalSupply()).div(getValueInPool());
            USDT.safeTransferFrom(msg.sender, address(this), _amount);
            feeAmount = feeAmount.div(1e12);
        } else {
            revert("Invalid deposit Token");
        }

        transferNetworkFee(feeAmount, _token);

        depositedAmount[msg.sender] = _amount.sub(feeAmount);
        strategy.deposit(_amount.sub(feeAmount), _token);
        
        _mint(msg.sender, shares);
        emit Deposit(msg.sender, address(_token), _amount, shares);
    }

    /**
     * @notice Withdraw from strategy
     * @param _shares shares to withdraw
     * Requirements:
     * - Only EOA account can call this function
     */
    function withdraw(uint256 _shares, IERC20 _token) external {
        require(msg.sender == tx.origin, "Only EOA");
        require(_shares > 0, "Invalid amount");
        uint256 _totalShares = balanceOf(msg.sender);
        require(_totalShares >= _shares, "Insuffient funds");
        uint _fee;

        uint amount = getValueInPool().mul(_shares).div(totalSupply());
        uint _depositedAmount = depositedAmount[msg.sender].mul(_shares).div(_totalShares);
        depositedAmount[msg.sender] = depositedAmount[msg.sender].sub(_depositedAmount);

        console.log('amount', amount);

        if(amount > _depositedAmount) {
            uint256 _profit = amount.sub(_depositedAmount);
            _fee = _profit.mul(profitSharingFeePerc).div(10000);
            amount = amount.sub(_fee);
            _fee = _token == DAI ? _fee : _fee.div(1e12);
        }

        strategy.withdraw(amount, _token);
        console.log('balanceInContract', _token.balanceOf(address(this)));

        if(_fee != 0) {
            _token.safeTransfer(treasuryWallet, _fee);
        }

        uint amountToWithdraw = _token.balanceOf(address(this));
        _token.safeTransfer(msg.sender,  amountToWithdraw);

        _burn(msg.sender, _shares);
        emit Withdraw(msg.sender, address(_token), amountToWithdraw, _shares);
    }

    function harvest() external {
        require(msg.sender == admin, "onlyAdmin");
        strategy.harvest();

        emit Harvest(block.timestamp);
    }

    function setPendingStrategy(address _pendingStrategy) external {
        require(msg.sender == admin, "Only admin");
        require(canSetPendingStrategy, "Cannot set strategy");
        require(_pendingStrategy != address(0), "Invalid strategy address");

        address oldStrategy = address(strategy);
        pendingStrategy = _pendingStrategy;
        emit SetPendingStrategy(oldStrategy, _pendingStrategy);
    }

    function unlockMigrateFunds() external {
        require(msg.sender == admin, "Only Admin");
        unlockTime = block.timestamp.add(LOCKTIME);
        canSetPendingStrategy = false;
    }

    function migrateFunds(IERC20 _token) external {
        require(msg.sender == admin, "Only Admin");
        require(unlockTime <= block.timestamp && unlockTime.add(1 days) >= block.timestamp, "Function locked");
        
        address oldStrategy = address(strategy);

        strategy.migrateFunds(_token);
        uint amount = _token.balanceOf(address(this));

        strategy = IStrategy(pendingStrategy);
        strategy.setVault(address(this));
        strategy.deposit(amount, _token);

        canSetPendingStrategy = true;
        emit MigrateFunds(oldStrategy, pendingStrategy, amount);
    }

    function setAdmin(address _newAdmin) external {
        require(msg.sender == admin, "Only Admin");
        address oldAdmin = admin;
        admin = _newAdmin;

        strategy.setAdmin(_newAdmin);
        emit SetAdmin(oldAdmin, _newAdmin);
    }

    function setTreasuryWallet(address _treasuryWallet) external {
        require(msg.sender == admin, "Only admin");
        address oldTreasuryWallet = treasuryWallet;
        treasuryWallet = _treasuryWallet;

        emit SetTreasuryWallet(oldTreasuryWallet, _treasuryWallet);
    }

    function setCommunityWallet(address _communityWallet) external {
        require(msg.sender == admin, "Only admin");
        address oldCommunityWallet = communityWallet;
        communityWallet = _communityWallet;

        emit SetCommunityWallet(oldCommunityWallet, communityWallet);
    }

    function setStrategist(address _strategist) external {
        require(msg.sender == admin, "Only admin");
        strategist = _strategist;
    }

    function getValueInPool() public view returns (uint){
        return strategy.getValueInPool();
    }

    function _calcSharesAfterNetworkFee(uint _amount) internal view returns (uint amountAfterFee, uint fee) {
        uint256 _networkFeePerc;
        if (_amount < networkFeeTier2[0]) {
            // Tier 1
            _networkFeePerc = networkFeePerc[0];
        } else if (_amount <= networkFeeTier2[1]) {
            // Tier 2
            _networkFeePerc = networkFeePerc[1];
        } else if (_amount < customNetworkFeeTier) {
            // Tier 3
            _networkFeePerc = networkFeePerc[2];
        } else {
            // Custom Tier
            _networkFeePerc = customNetworkFeePerc;
        }

        fee = _amount.mul(_networkFeePerc).div(10000);
        amountAfterFee = _amount.sub(fee);

    }

    function transferNetworkFee(uint _fee, IERC20 _token) internal {
        uint _feeSplit = _fee.mul(2).div(5);
        _token.safeTransfer(treasuryWallet, _feeSplit);
        _token.safeTransfer(communityWallet, _feeSplit);
        _token.safeTransfer(strategist, _fee.sub(_feeSplit).sub(_feeSplit));
    }
}
