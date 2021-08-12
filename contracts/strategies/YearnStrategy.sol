// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "hardhat/console.sol";

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

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB);

    function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts);
}

interface ISLPToken is IERC20Upgradeable {
    function getReserves() external view returns (uint112, uint112, uint32);
}

interface IPickleJar is IERC20Upgradeable {
    function deposit(uint) external;
    function withdraw(uint) external;
    function getRatio() external view returns (uint);
}

interface IPickleFarm {
    function deposit(uint) external;
    function withdraw(uint) external;
    function getReward() external;
    function balanceOf(address) external view returns (uint);
}

interface IChainlink {
    function latestAnswer() external view returns (int256);
}

interface IVault {
    function totalSupply() external view returns (uint);
}

interface IDAOmine {
    function depositByProxy(address _user, uint256 _pid, uint256 _amount) external;
}

/// @notice In this strategy, we treat all Stablecoins as same price (1 USD)
contract YearnStrategy is Initializable, ERC20Upgradeable, OwnableUpgradeable,
        ReentrancyGuardUpgradeable, PausableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeERC20Upgradeable for ISLPToken;
    using SafeERC20Upgradeable for IPickleJar;

    IERC20Upgradeable constant USDT = IERC20Upgradeable(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    IERC20Upgradeable constant USDC = IERC20Upgradeable(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20Upgradeable constant DAI = IERC20Upgradeable(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IERC20Upgradeable constant TUSD = IERC20Upgradeable(0x0000000000085d4780B73119b644AE5ecd22b376);

    address constant USDTVault = 0x4F0C1c9bA6B9CCd0BEd6166e86b672ac8EE621F7;
    address constant USDCVault = 0x9f0230FbDC0379E5FefAcca89bE03A42Fec5fb6E;
    address constant DAIVault = 0x2bFc2Da293C911e5FfeC4D2A2946A599Bc4Ae770;
    address constant TUSDVault = 0x2C8de02aD4312069355B94Fb936EFE6CFE0C8FF6;

    IERC20Upgradeable constant WETH = IERC20Upgradeable(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IRouter constant sRouter = IRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
    ISLPToken constant SLPToken = ISLPToken(0x9461173740D27311b176476FA27e94C681b1Ea6b);
    IERC20Upgradeable constant yvBOOST = IERC20Upgradeable(0x9d409a0A012CFbA9B15F6D4B36Ac57A46966Ab9a);
    IPickleJar constant pJar = IPickleJar(0xCeD67a187b923F0E5ebcc77C7f2F7da20099e378);
    IPickleFarm constant pFarm = IPickleFarm(0xDA481b277dCe305B97F4091bD66595d57CF31634);
    IERC20Upgradeable constant PICKLE = IERC20Upgradeable(0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5);

    mapping(address => IERC20Upgradeable) tokens;
    uint public balanceOfAllTokens; // 18 decimals
    uint public percKeepInVault;
    address public admin;

    // Calculation for fees
    uint256[] public networkFeeTier2;
    uint256 public customNetworkFeeTier;
    uint256[] public networkFeePerc;
    uint256 public customNetworkFeePerc;

    // Address to collect fees
    address public treasury;
    address public community;
    address public strategist;

    // All events here

    modifier onlyVault {
        require(
            msg.sender == USDTVault ||
            msg.sender == USDCVault ||
            msg.sender == DAIVault ||
            msg.sender == TUSDVault,
            "Only vault"
        );
        _;
    }

    event Deposit(address indexed caller, uint256 amtDeposit, uint256 sharesMint);
    event Withdraw(address indexed caller, uint256 amtWithdraw, uint256 sharesBurn);

    modifier onlyOwnerOrAdmin {
        require(msg.sender == owner() || msg.sender == address(admin), "Only owner or admin");
        _;
    }

    function initialize(
        address _treasury, address _community, address _strategist, address _admin
    ) external initializer {
        __ERC20_init("Yearn yvBOOST Strategy", "daoYYS");
        __Ownable_init();

        treasury = _treasury;
        community = _community;
        strategist = _strategist;
        admin = _admin;

        networkFeeTier2 = [50000*1e18+1, 100000*1e18];
        customNetworkFeeTier = 1000000*1e18;
        networkFeePerc = [100, 75, 50]; // 100
        customNetworkFeePerc = 25;
        percKeepInVault = 10; // 150

        tokens[USDTVault] = USDT;
        tokens[USDCVault]= USDC;
        tokens[DAIVault] = DAI;
        tokens[TUSDVault] = TUSD;

        USDT.safeApprove(address(sRouter), type(uint).max);
        USDC.safeApprove(address(sRouter), type(uint).max);
        DAI.safeApprove(address(sRouter), type(uint).max);
        TUSD.safeApprove(address(sRouter), type(uint).max);
        WETH.safeApprove(address(sRouter), type(uint).max);
        yvBOOST.safeApprove(address(sRouter), type(uint).max);
        PICKLE.safeApprove(address(sRouter), type(uint).max);
        SLPToken.safeApprove(address(pJar), type(uint).max);
        SLPToken.safeApprove(address(sRouter), type(uint).max);
        pJar.safeApprove(address(pFarm), type(uint).max);
    }

    function deposit(uint256[] memory amounts) external onlyVault nonReentrant whenNotPaused {
        uint256 amount = amounts[0];
        require(amount > 0, "Amount == 0");

        uint pool = getAllPoolInUSD();
        IERC20Upgradeable token = tokens[msg.sender];
        token.safeTransferFrom(tx.origin, address(this), amount);
        uint amtDeposit = amount; // For event purpose

        // Calculate network fee
        if (token == USDT || token == USDC) amount = amount * 1e12;
        uint _networkFeePerc;
        if (amount < networkFeeTier2[0]) _networkFeePerc = networkFeePerc[0]; // Tier 1
        else if (amount <= networkFeeTier2[1]) _networkFeePerc = networkFeePerc[1]; // Tier 2
        else if (amount < customNetworkFeeTier) _networkFeePerc = networkFeePerc[2]; // Tier 3
        else _networkFeePerc = customNetworkFeePerc; // Custom Tier
        amount = amount - (amount * _networkFeePerc / 10000);

        uint _totalSupply = totalSupply();
        uint shares = _totalSupply == 0 ? amount : amount * _totalSupply / pool;
        uint sharesMint = _mint(msg.sender, shares);
        balanceOfAllTokens = balanceOfAllTokens + amount;

        emit Deposit(tx.origin, amtDeposit, sharesMint);
    }

    function withdraw(uint[] memory shares) external onlyVault nonReentrant {
        uint share = shares[0];
        require(share > 0, "Share == 0");

        uint withdrawAmt;
        IERC20Upgradeable token = tokens[msg.sender];
        if (token == USDT || token == USDC) {
            withdrawAmt = getAllPoolInUSD() * (share * 1e12) / totalSupply(); // 18 decimals
            _burn(msg.sender, share);
            if (token.balanceOf(address(this)) * 1e12 < withdrawAmt) {
                withdrawAmt = _withdraw(withdrawAmt, token); // 6 decimals
            } else {
                balanceOfAllTokens = balanceOfAllTokens - withdrawAmt;
                withdrawAmt = withdrawAmt / 1e12;
            }
            token.safeTransfer(tx.origin, withdrawAmt);
        } else { // DAI || TUSD
            withdrawAmt = getAllPoolInUSD() * share / totalSupply(); // 18 decimals
            _burn(msg.sender, share);
            if (token.balanceOf(address(this)) < withdrawAmt) {
                withdrawAmt = _withdraw(withdrawAmt, token); // 18 decimals
            } else {
                balanceOfAllTokens = balanceOfAllTokens - withdrawAmt;
            }
            token.safeTransfer(tx.origin, withdrawAmt);
        }

        emit Withdraw(tx.origin, withdrawAmt, share);
    }

    /// @param amount Amount to withdraw in USD (18 decimals)
    function _withdraw(uint amount, IERC20Upgradeable token) private returns (uint) {
        uint farmPool = getFarmPoolInUSD();
        uint percInFarmPool = amount * 1e18 / farmPool; // decimals
        pFarm.withdraw(percInFarmPool * pFarm.balanceOf(address(this)) / 1e18);
        pJar.withdraw(pJar.balanceOf(address(this)));
        (uint yvBOOSTBal, uint WETHBal) = sRouter.removeLiquidity(address(yvBOOST), address(WETH), SLPToken.balanceOf(address(this)), 0, 0, address(this), block.timestamp);
        // sell yvBOOST & WETH to Stablecoin
        uint tokenBal0 = swap3(address(yvBOOST), address(token), yvBOOSTBal);
        uint tokenBal1 = swap2(address(WETH), address(token), WETHBal);
        return tokenBal0 + tokenBal1;
    }

    function invest() public onlyOwnerOrAdmin whenNotPaused {
        uint USDTBal = USDT.balanceOf(address(this)) * 1e12;
        uint USDCBal = USDC.balanceOf(address(this)) * 1e12;
        uint DAIBal = DAI.balanceOf(address(this));
        uint TUSDBal = TUSD.balanceOf(address(this));

        // Transfer out fees
        uint totalBal = USDTBal + USDCBal + DAIBal + TUSDBal;
        if (totalBal > balanceOfAllTokens) {
            uint fees = totalBal - balanceOfAllTokens;
            if (USDTBal > fees) {
                _transferOutFees(fees / 1e12, USDT);
                USDTBal = USDTBal - fees;
            } else if (USDCBal > fees) {
                _transferOutFees(fees / 1e12, USDC);
                USDCBal = USDCBal - fees;
            } else if (DAIBal > fees) {
                _transferOutFees(fees, DAI);
                DAIBal = DAIBal - fees;
            } else if (TUSDBal > fees) {
                _transferOutFees(fees, TUSD);
                TUSDBal = TUSDBal - fees;
            }

        // emit TransferredOutFees(amount); // Decimal follow _token
        }


        IERC20Upgradeable[4] memory _tokens = [USDT, USDC, DAI, TUSD];
        uint[4] memory tokenBal = [USDTBal, USDCBal, DAIBal, TUSDBal];
        uint amtKeepInVault = getAllPoolInUSD() * percKeepInVault / 10000;
        for (uint i = 0; i < 4; i ++) {
            if (tokenBal[i] > 0) {
                if (tokenBal[i] > amtKeepInVault) {
                    uint toInvest = tokenBal[i] - amtKeepInVault;
                    balanceOfAllTokens = balanceOfAllTokens - toInvest;
                    if (_tokens[i] == USDT || _tokens[i] == USDC) toInvest = toInvest / 1e12;
                    swap2(address(_tokens[i]), address(WETH), toInvest);
                }
            }
        }

        _invest();
    }

    function _invest() private {
        // console.log(WETH.balanceOf(address(this)));
        uint halfWETH = WETH.balanceOf(address(this)) / 2;
        // console.log(halfWETH);
        uint yvBOOSTBal = swap2(address(WETH), address(yvBOOST), halfWETH);
        (,, uint SLPTokenBal) = sRouter.addLiquidity(address(yvBOOST), address(WETH), yvBOOSTBal, halfWETH, 0, 0, address(this), block.timestamp);
        pJar.deposit(SLPTokenBal);
        pFarm.deposit(pJar.balanceOf(address(this)));
    }

    function yield() external onlyOwnerOrAdmin {
        pFarm.getReward();
        swap2(address(PICKLE), address(WETH), PICKLE.balanceOf(address(this)));
        _invest();
    }

    function transferOutFees() external onlyOwnerOrAdmin {
        uint USDTBal = USDT.balanceOf(address(this)) * 1e12;
        uint USDCBal = USDC.balanceOf(address(this)) * 1e12;
        uint DAIBal = DAI.balanceOf(address(this));
        uint TUSDBal = TUSD.balanceOf(address(this));

        uint totalBal = USDTBal + USDCBal + DAIBal + TUSDBal;
        if (totalBal > balanceOfAllTokens) {
            uint fees = totalBal - balanceOfAllTokens;
            if (USDTBal > fees) {
                _transferOutFees(fees / 1e12, USDT);
                USDTBal = USDTBal - fees;
            } else if (USDCBal > fees) {
                _transferOutFees(fees / 1e12, USDC);
                USDCBal = USDCBal - fees;
            } else if (DAIBal > fees) {
                _transferOutFees(fees, DAI);
                DAIBal = DAIBal - fees;
            } else if (TUSDBal > fees) {
                _transferOutFees(fees, TUSD);
                TUSDBal = TUSDBal - fees;
            }
        // emit TransferredOutFees(amount); // Decimal follow _token
        }
    }

    function _transferOutFees(uint amount, IERC20Upgradeable token) private {
        uint256 fee = amount * 2 / 5; // (40%)
        token.safeTransfer(treasury, fee); // 40%
        token.safeTransfer(community, fee); // 40%
        token.safeTransfer(strategist, amount - fee - fee); // 20%
    }

    /// @param amount Amount to retrieve in USD (18 decimals)
    function retrievetokenFromFarm(uint amount, IERC20Upgradeable token) external onlyOwnerOrAdmin {
        uint retrieveAmt = _withdraw(amount, token);
        balanceOfAllTokens = balanceOfAllTokens + retrieveAmt;
        // emit RetrievetokenFromStrategy(_amount);
    }

    function emergencyWithdraw() external onlyOwnerOrAdmin {
        _pause();
        
        pFarm.getReward();
        swap2(address(PICKLE), address(WETH), PICKLE.balanceOf(address(this)));

        pFarm.withdraw(pFarm.balanceOf(address(this)));
        pJar.withdraw(pJar.balanceOf(address(this)));
        (uint yvBOOSTBal,) = sRouter.removeLiquidity(address(yvBOOST), address(WETH), SLPToken.balanceOf(address(this)), 0, 0, address(this), block.timestamp);
        swap2(address(yvBOOST), address(WETH), yvBOOSTBal);
    }

    /// @notice Function to reinvest funds into strategy
    function reinvest() external onlyOwnerOrAdmin whenPaused {
        _unpause();
        invest();
    }

    function approveMigrate() external onlyOwner whenPaused {
        USDT.safeApprove(USDTVault, type(uint).max);
        USDT.safeApprove(USDCVault, type(uint).max);
        USDT.safeApprove(DAIVault, type(uint).max);
        USDT.safeApprove(TUSDVault, type(uint).max);
    }

    function initialInvest() external onlyOwner {
        uint USDTBal = USDT.balanceOf(address(this)) * 1e12;
        uint USDCBal = USDC.balanceOf(address(this)) * 1e12;
        uint DAIBal = DAI.balanceOf(address(this));
        uint TUSDBal = TUSD.balanceOf(address(this));
        balanceOfAllTokens = USDTBal + USDCBal + DAIBal + TUSDBal;

        IERC20Upgradeable[4] memory _tokens = [USDT, USDC, DAI, TUSD];
        uint[4] memory tokenBal = [USDTBal, USDCBal, DAIBal, TUSDBal];
        uint amtKeepInVault = balanceOfAllTokens * percKeepInVault / 10000; // 18 decimals
        for (uint i = 0; i < 4; i ++) {
            if (tokenBal[i] > 0) {
                if (tokenBal[i] > amtKeepInVault) {
                    uint toInvest = tokenBal[i] - amtKeepInVault;
                    balanceOfAllTokens = balanceOfAllTokens - toInvest;
                    if (_tokens[i] == USDT || _tokens[i] == USDC) toInvest = toInvest / 1e12;
                    swap2(address(_tokens[i]), address(WETH), toInvest);
                }
            }
        }

        _invest();

        _mint(USDTVault, IVault(USDTVault).totalSupply() * 1e12);
        _mint(USDCVault, IVault(USDCVault).totalSupply() * 1e12);
        _mint(DAIVault, IVault(DAIVault).totalSupply());
        _mint(TUSDVault, IVault(TUSDVault).totalSupply());
    }

    function swap2(address tokenIn, address tokenOut, uint amount) private returns (uint) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        uint[] memory amounts = sRouter.swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp);
        return amounts[1];
    }

    function swap3(address tokenIn, address tokenOut, uint amount) private returns (uint) {
        address[] memory path = new address[](3);
        path[0] = tokenIn;
        path[1] = address(WETH);
        path[2] = tokenOut;
        uint[] memory amounts = sRouter.swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp);
        return amounts[2];
    }

    function getSLPTokenPriceInUSD(uint yvBOOSTReserve, uint WETHReserve) private view returns (uint) {
        address[] memory path = new address[](2);
        path[0] = address(yvBOOST);
        path[1] = address(WETH);
        uint yvBOOSTPriceInETH = sRouter.getAmountsOut(1e18, path)[1];
        uint totalReserveInETH = uint(yvBOOSTReserve) * yvBOOSTPriceInETH / 1e18 + uint(WETHReserve);
        uint WETHPriceInUSD = uint(IChainlink(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419).latestAnswer());
        uint totalReserveInUSD = totalReserveInETH * WETHPriceInUSD; // 26 decimals
        return totalReserveInUSD * 1e10 / SLPToken.totalSupply(); // 18 decimals
    }

    function getFarmPoolInUSD() public view returns (uint) {
        uint SLPTokenBal = pFarm.balanceOf(address(this)) * pJar.getRatio() / 1e18;
        (uint112 yvBOOSTReserve, uint112 WETHReserve,) = SLPToken.getReserves();
        uint SLPTokenPrice = getSLPTokenPriceInUSD(yvBOOSTReserve, WETHReserve);
        return SLPTokenBal * SLPTokenPrice / 1e18; // 18 decimals
    }

    /// @return All Pool in USD (18 decimals)
    function getAllPoolInUSD() public view returns (uint) {
        return getFarmPoolInUSD() + balanceOfAllTokens;
    }
}