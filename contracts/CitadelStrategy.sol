// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

interface ICurvePairs {
    function add_liquidity(uint256[2] memory _amounts, uint256 _min_mint_amount) external;
    function remove_liquidity_one_coin(uint256 _token_amount, int128 i, uint256 _min_amount) external;
    function balances(uint256 i) external view returns (uint256);
}

interface IGauge {
    function balanceOf(address _address) external view returns (uint256);
    function deposit(uint256 _amount) external;
    function withdraw(uint256 _amount) external;
}

interface IMintr {
    function mint(address _address) external;
}

interface IveCRV {
    function create_lock(uint256 _amount, uint256 _unlock_time) external;
    function withdraw() external;
}

interface IRouter {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint[] memory amounts);

    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        returns (uint[] memory amounts);
}

interface IPickleJar is IERC20 {
    function deposit(uint256 _amount) external;
    function withdraw(uint256 _amount) external;
    function balance() external view returns (uint256);
}

interface IMasterChef {
    function deposit(uint256 _pid, uint256 _amount) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
    function userInfo(uint256, address) external returns(uint256, uint256);
}

interface IGaugeP {
    function deposit(uint256 _amount) external;
    function withdraw(uint256 _amount) external;
    function balanceOf(address) external view returns (uint256);
    function getReward() external;
}

interface IWETH is IERC20 {
    function withdraw(uint256 _amount) external;
}

interface ICitadelVault {
    function getVaultPoolInETH() external view returns (uint256);
    function getReimburseTokenAmount(uint8) external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
}

interface IChainlink {
    function latestRoundData() external view returns (uint80, int, uint256, uint256, uint80);
}

interface ISLPToken is IERC20 {
    function getReserves() external view returns (uint112, uint112, uint32);
}

contract CitadelStrategy is Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;
    using SafeERC20 for IPickleJar;
    using SafeERC20 for ISLPToken;
    using SafeMath for uint256;

    IERC20 public constant WBTC = IERC20(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);
    IWETH public constant WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 public constant USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    IERC20 public constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20 public constant DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IRouter public constant router = IRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
    ICitadelVault public vault;

    // Curve
    ICurvePairs public constant cPairs = ICurvePairs(0x4CA9b3063Ec5866A4B82E437059D2C43d1be596F); // HBTC/WBTC
    IERC20 public constant clpToken = IERC20(0xb19059ebb43466C323583928285a49f558E572Fd);
    IERC20 public constant CRV = IERC20(0xD533a949740bb3306d119CC777fa900bA034cd52);
    IGauge public constant gaugeC = IGauge(0x4c18E409Dc8619bFb6a1cB56D114C3f592E0aE79);
    IMintr public constant mintr = IMintr(0xd061D61a4d941c39E5453435B6345Dc261C2fcE0);
    IveCRV public constant veCRV = IveCRV(0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2);
    uint256[] public curveSplit = [10000, 0]; // CRV to reinvest, to lock

    // Pickle
    ISLPToken public constant slpWBTC = ISLPToken(0xCEfF51756c56CeFFCA006cD410B03FFC46dd3a58);
    ISLPToken public constant slpDAI = ISLPToken(0xC3D03e4F041Fd4cD388c549Ee2A29a9E5075882f);
    IERC20 public constant PICKLE = IERC20(0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5);
    IPickleJar public constant pickleJarWBTC = IPickleJar(0xde74b6c547bd574c3527316a2eE30cd8F6041525);
    IPickleJar public constant pickleJarDAI = IPickleJar(0x55282dA27a3a02ffe599f6D11314D239dAC89135);
    IGaugeP public constant gaugeP_WBTC = IGaugeP(0xD55331E7bCE14709d825557E5Bca75C73ad89bFb);
    IGaugeP public constant gaugeP_DAI = IGaugeP(0x6092c7084821057060ce2030F9CC11B22605955F);

    // Sushiswap Onsen
    IERC20 public constant DPI = IERC20(0x1494CA1F11D487c2bBe4543E90080AeBa4BA3C2b);
    ISLPToken public constant slpDPI = ISLPToken(0x34b13F8CD184F55d0Bd4Dd1fe6C07D46f245c7eD);
    IERC20 public constant SUSHI = IERC20(0x6B3595068778DD592e39A122f4f5a5cF09C90fE2);
    IMasterChef public constant masterChef = IMasterChef(0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd);

    // LP token price in USD (8 decimals)
    uint256 private _HBTCWBTCLPTokenPrice;
    uint256 private _WBTCETHLPTokenPrice;
    uint256 private _DPIETHLPTokenPrice;
    uint256 private _DAIETHLPTokenPrice;
    enum Price { INCREASE, DECREASE }

    // Pool (in ETH)
    uint256 private pool; // Strategy TVL in ETH
    uint256 private _poolHBTCWBTC;
    uint256 private _poolWBTCETH;
    uint256 private _poolDPIETH;
    uint256 private _poolDAIETH;
    // uint256 private _poolHBTCWBTC = 3e17;
    // uint256 private _poolWBTCETH = 3e17;
    // uint256 private _poolDPIETH = 3e17;
    // uint256 private _poolDAIETH = 1e17;

    // Others
    uint256 public constant DENOMINATOR = 10000;
    uint256[] public WEIGHTS = [3000, 3000, 3000, 1000];
    // WEIGHTS: 30% Curve HBTC/WBTC, 30% Pickle WBTC/ETH, 30% Sushiswap DPI/ETH, 10% Pickle DAI/ETH

    // Fees
    uint256 public yieldFeePerc = 1000;
    address public admin;
    address public treasuryWallet;
    address public communityWallet;

    event AddLiquidityCurveWBTC(uint256 amount, uint256 liquidity);
    event AddLiquidityPickleWBTC(uint256 amountA, uint256 amountB, uint256 liquidity);
    event AddLiquidityIndexDPI(uint256 amountA, uint256 amountB, uint256 liquidity);
    event AddLiquidityPickleDAI(uint256 amountA, uint256 amountB, uint256 liquidity);

    modifier onlyVault {
        require(msg.sender == address(vault), "Only vault");
        _;
    }

    constructor(address _treasuryWallet, address _communityWallet, address _admin) {
        treasuryWallet = _treasuryWallet;
        communityWallet = _communityWallet;
        admin = _admin;

        // Sushiswap router
        WETH.safeApprove(address(router), type(uint256).max);
        WBTC.safeApprove(address(router), type(uint256).max);
        DAI.safeApprove(address(router), type(uint256).max);
        slpWBTC.safeApprove(address(router), type(uint256).max);
        slpDAI.safeApprove(address(router), type(uint256).max);
        slpDPI.safeApprove(address(router), type(uint256).max);
        CRV.safeApprove(address(router), type(uint256).max);
        PICKLE.safeApprove(address(router), type(uint256).max);
        SUSHI.safeApprove(address(router), type(uint256).max);
        // Curve
        WBTC.safeApprove(address(cPairs), type(uint256).max);
        clpToken.safeApprove(address(gaugeC), type(uint256).max);
        CRV.safeApprove(address(veCRV), type(uint256).max);
        // Pickle
        slpWBTC.safeApprove(address(pickleJarWBTC), type(uint256).max);
        slpDAI.safeApprove(address(pickleJarDAI), type(uint256).max);
        pickleJarWBTC.safeApprove(address(gaugeP_WBTC), type(uint256).max);
        pickleJarDAI.safeApprove(address(gaugeP_DAI), type(uint256).max);
        // Sushiswap Onsen
        DPI.safeApprove(address(router), type(uint256).max);
        slpDPI.safeApprove(address(masterChef), type(uint256).max);

        (uint256 _clpTokenPriceHBTC, uint256 _pSlpTokenPriceWBTC, uint256 _slpTokenPriceDPI, uint256 _pSlpTokenPriceDAI) = _getLPTokenPrice();
        _HBTCWBTCLPTokenPrice = _clpTokenPriceHBTC;
        _WBTCETHLPTokenPrice = _pSlpTokenPriceWBTC;
        _DPIETHLPTokenPrice = _slpTokenPriceDPI;
        _DAIETHLPTokenPrice = _pSlpTokenPriceDAI;
    }

    function setVault(address _address) external onlyOwner {
        require(address(vault) == address(0), "Vault set");

        vault = ICitadelVault(_address);
    }

    function invest(uint256 _amount) external onlyVault {
        WETH.safeTransferFrom(address(vault), address(this), _amount);
        if (getTotalPool() > 0) { // Not first invest
            _updatePoolForPriceChange();
            _yield();
        }
        _farming();
    }

    function _yield() private {
        // 1) Claim all rewards
        uint256 _yieldFees;
        // Curve HBTC/WBTC
        mintr.mint(address(gaugeC)); // Claim CRV
        uint256 _balanceOfCRV = CRV.balanceOf(address(this));
        if (_balanceOfCRV > 0) {
            // Split to reinvest and to lock
            if (curveSplit[0] > 0) {
                uint256 _amountIn = _balanceOfCRV.mul(curveSplit[0]).div(DENOMINATOR);
                uint256[] memory _amounts = _swapExactTokensForTokens(address(CRV), address(WETH), _amountIn);
                uint256 _fee = _amounts[1].mul(yieldFeePerc).div(DENOMINATOR);
                _poolHBTCWBTC = _poolHBTCWBTC.add(_amounts[1].sub(_fee));
                _yieldFees = _yieldFees.add(_fee);
            }
            if (curveSplit[1] > 0) {
                veCRV.create_lock(
                    _balanceOfCRV.mul(curveSplit[1]).div(DENOMINATOR),
                    block.timestamp + 86400 * 365 * 4
                );
            }
        }
        // Pickle WBTC/ETH
        gaugeP_WBTC.getReward(); // Claim PICKLE
        uint256 _balanceOfPICKLEForWETH = PICKLE.balanceOf(address(this));
        if (_balanceOfPICKLEForWETH > 0) {
            uint256[] memory _amounts = _swapExactTokensForTokens(address(PICKLE), address(WETH), _balanceOfPICKLEForWETH);
            uint256 _fee = _amounts[1].mul(yieldFeePerc).div(DENOMINATOR);
            _poolWBTCETH = _poolWBTCETH.add(_amounts[1].sub(_fee));
            _yieldFees = _yieldFees.add(_fee);
        }
        // Sushiswap DPI/ETH
        (uint256 _slpDPIAmt,) = masterChef.userInfo(42, address(this));
        if (_slpDPIAmt > 0) {
            masterChef.withdraw(42, _slpDPIAmt); // Claim remain SUSHI
            // Swap SUSHI to WETH
            uint256 _balanceOfSUSHI = SUSHI.balanceOf(address(this));
            if (_balanceOfSUSHI > 0) {
                uint256[] memory _amounts = _swapExactTokensForTokens(address(SUSHI), address(WETH), _balanceOfSUSHI);
                uint256 _fee = _amounts[1].mul(yieldFeePerc).div(DENOMINATOR);
                _poolDPIETH = _poolDPIETH.add(_amounts[1].sub(_fee));
                _yieldFees = _yieldFees.add(_fee);
            }
        }
        // Pickle DAI/ETH
        gaugeP_DAI.getReward(); // Claim PICKLE
        uint256 _balanceOfPICKLEForDAI = PICKLE.balanceOf(address(this));
        if (_balanceOfPICKLEForDAI > 0) {
            uint256[] memory _amounts = _swapExactTokensForTokens(address(PICKLE), address(WETH), _balanceOfPICKLEForDAI);
            uint256 _fee = _amounts[1].mul(yieldFeePerc).div(DENOMINATOR);
            _poolDAIETH = _poolDAIETH.add(_amounts[1].sub(_fee));
            _yieldFees = _yieldFees.add(_fee);
        }

        // 2) Split yield fees
        _splitYieldFees(_yieldFees);

        // 3) Reinvest rewards
        _updatePoolForProvideLiquidity(getTotalPool());
    }

    // To enable receive ETH from WETH
    receive() external payable {}

    function _farming() private {
        uint256 _totalPoolAddTotalDeposit = getTotalPool().add(WETH.balanceOf(address(this)));
        _updatePoolForProvideLiquidity(_totalPoolAddTotalDeposit);
        // console.log("_poolHBTCWBTC", _poolHBTCWBTC);
        // console.log("_poolWBTCETH", _poolWBTCETH);
        // console.log("_poolDPIETH", _poolDPIETH);
        // console.log("_poolDAIETH", _poolDAIETH);
    }

    function reimburse() external onlyVault {
        // Get total reimburse amount (6 decimals)
        uint256 _reimburseUSDT = vault.getReimburseTokenAmount(0);
        uint256 _reimburseUSDC = vault.getReimburseTokenAmount(1);
        uint256 _reimburseDAI = vault.getReimburseTokenAmount(2);
        uint256 _totalReimburse = _reimburseUSDT.add(_reimburseUSDC).add(_reimburseDAI.div(10e11));

        // Get ETH needed from farm (by removing liquidity then swap to ETH)
        uint256[] memory _amounts = router.getAmountsOut(_totalReimburse, _getPath(address(USDT), address(WETH)));
        if (WETH.balanceOf(address(this)) < _amounts[1]) {
            _withdrawCurve(_amounts[1].mul(WEIGHTS[0]).div(DENOMINATOR));
            _withdrawPickleWBTC(_amounts[1].mul(WEIGHTS[1]).div(DENOMINATOR));
            _withdrawSushiswap(_amounts[1].mul(WEIGHTS[2]).div(DENOMINATOR));
            _withdrawPickleDAI(_amounts[1].mul(WEIGHTS[3]).div(DENOMINATOR));
            _swapAllToETH();
        }

        // Swap WETH to token and transfer back to vault
        _reimburse(_reimburseUSDT, USDT);
        _reimburse(_reimburseUSDC, USDC);
        _reimburse(_reimburseDAI, DAI);
    }

    function _reimburse(uint256 _reimburseToken, IERC20 _token) private {
        if (_reimburseToken > 0) {
            // Get amount ETH needed for token
            uint256[] memory _amountsOut = router.getAmountsOut(_reimburseToken, _getPath(address(_token), address(WETH)));
            // Swap ETH to token and transfer to vault
            uint256[] memory _amounts = _swapExactTokensForTokens(address(WETH), address(_token), _amountsOut[1]);
            _token.safeTransfer(address(vault), _amounts[1]);
        }
    }

    function emergencyWithdraw() external onlyVault {
        // Withdraw all token from all farms
        // Curve HBTC/WBTC
        mintr.mint(address(gaugeC));
        _withdrawCurve(_poolHBTCWBTC);
        // Pickle WBTC/ETH
        gaugeP_WBTC.getReward();
        _withdrawPickleWBTC(_poolWBTCETH);
        // Sushiswap DPI/ETH
        _withdrawSushiswap(_poolDPIETH);
        // Pickle DAI/ETH
        gaugeP_WBTC.getReward();
        _withdrawPickleDAI(_poolDAIETH);

        // Swap all rewards to WETH
        uint256 balanceOfWETHBefore = WETH.balanceOf(address(this));
        _swapExactTokensForTokens(address(CRV), address(WETH), CRV.balanceOf(address(this)));
        _swapExactTokensForTokens(address(PICKLE), address(WETH), PICKLE.balanceOf(address(this)));
        _swapExactTokensForTokens(address(SUSHI), address(WETH), SUSHI.balanceOf(address(this)));
        // Send portion rewards to admin
        uint256 _rewards = (WETH.balanceOf(address(this))).sub(balanceOfWETHBefore);
        uint256 _adminFees = _rewards.mul(yieldFeePerc).div(DENOMINATOR);
        _splitYieldFees(_adminFees);

        // Swap all token to WETH
        _swapAllToETH();
        pool = WETH.balanceOf(address(this));
    }

    function reinvest() external onlyVault {
        _farming();
    }

    function _swapExactTokensForTokens(address _tokenA, address _tokenB, uint256 _amountIn) private returns (uint256[] memory _amounts) {
        address[] memory _path = _getPath(_tokenA, _tokenB);
        uint256[] memory _amountsOut = router.getAmountsOut(_amountIn, _path);
        if (_amountsOut[1] > 0) {
            _amounts = router.swapExactTokensForTokens(_amountIn, 0, _path, address(this), block.timestamp);
        } else {
            // Not enough amount to swap
            uint256[] memory _zeroReturn = new uint256[](2);
            _zeroReturn[0] = 0;
            _zeroReturn[1] = 0;
            return _zeroReturn;
        }
    }

    // function getStrategyTVLInETH() public view returns (uint256) {
    //     uint256 _ethPrice = _getTokenPriceFromChainlink(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
    //     return getTotalPool().mul(_ethPrice).div(1e20);
    // }

    function _getPath(address _tokenA, address _tokenB) private pure returns (address[] memory) {
        address[] memory _path = new address[](2);
        _path[0] = _tokenA;
        _path[1] = _tokenB;
        return _path;
    }

    function _getLPTokenPrice() private view returns (uint256, uint256, uint256, uint256) {
        uint256 _wbtcPrice = (router.getAmountsOut(1e18, _getPath(address(WBTC), address(WETH))))[1];
        uint256 _dpiPrice = _getTokenPriceFromChainlink(0x029849bbc0b1d93b85a8b6190e979fd38F5760E2);
        uint256 _daiPrice = _getTokenPriceFromChainlink(0x773616E4d11A78F511299002da57A0a94577F1f4);

        // Curve HBTC/WBTC
        uint256 _amountACurve = cPairs.balances(0); // HBTC, 18 decimals
        uint256 _amountBCurve = (cPairs.balances(1)).mul(1e10); // WBTC, 8 decimals to 18 decimals
        uint256 _totalValueOfHBTCWBTC = _calcTotalValueOfLiquidityPool(_amountACurve, _wbtcPrice, _amountBCurve, _wbtcPrice);
        uint256 _clpTokenPriceHBTC = _calcValueOf1LPToken(_totalValueOfHBTCWBTC, clpToken.totalSupply());

        // Pickle WBTC/ETH
        uint256 _pSlpTokenPriceWBTC = _calcPslpTokenPrice(pickleJarWBTC, slpWBTC, _wbtcPrice);

        // Sushiswap DPI/ETH
        uint256 _slpTokenPriceDPI = _calcSlpTokenPrice(slpDPI, _dpiPrice);

        // Pickle DAI/ETH
        uint256 _pSlpTokenPriceDAI = _calcPslpTokenPrice(pickleJarDAI, slpDAI, _daiPrice);

        return (_clpTokenPriceHBTC, _pSlpTokenPriceWBTC, _slpTokenPriceDPI, _pSlpTokenPriceDAI);
    }

    /// @notice This function is for testing purpose
    function _getLPTokenPriceTemp() private view returns (uint256, uint256, uint256, uint256) {
        uint256 _clpTokenPriceHBTC = _HBTCWBTCLPTokenPrice.add(_HBTCWBTCLPTokenPrice.mul(200).div(DENOMINATOR)); // 102%
        uint256 _pSlpTokenPriceWBTC = _WBTCETHLPTokenPrice.add(_WBTCETHLPTokenPrice.mul(200).div(DENOMINATOR)); // 102%
        uint256 _slpTokenPriceDPI = _DPIETHLPTokenPrice.sub(_DPIETHLPTokenPrice.mul(100).div(DENOMINATOR)); // 99%
        uint256 _pSlpTokenPriceDAI = _DAIETHLPTokenPrice; // 100%

        return (_clpTokenPriceHBTC, _pSlpTokenPriceWBTC, _slpTokenPriceDPI, _pSlpTokenPriceDAI);
    }

    function _calcPslpTokenPrice(IPickleJar _pslpToken, ISLPToken _slpToken, uint256 _tokenAPrice) private view returns (uint256) {
        uint256 _slpTokenPrice = _calcSlpTokenPrice(_slpToken, _tokenAPrice);
        uint256 _totalValueOfPSlpToken = _calcTotalValueOfLiquidityPool(_pslpToken.balance(), _slpTokenPrice, 0, 0);
        return _calcValueOf1LPToken(_totalValueOfPSlpToken, _pslpToken.totalSupply());
    }

    function _calcSlpTokenPrice(ISLPToken _slpToken, uint256 _tokenAPrice) private view returns (uint256) {
        (uint112 _reserveA, uint112 _reserveB,) = _slpToken.getReserves();
        _reserveA = _slpToken == slpWBTC ? _reserveA * 1e10 : _reserveA;
        uint256 _totalValueOfLiquidityPool = _calcTotalValueOfLiquidityPool(uint256(_reserveA), _tokenAPrice, uint256(_reserveB), 1);
        return _calcValueOf1LPToken(_totalValueOfLiquidityPool, _slpToken.totalSupply());
    }

    function _calcTotalValueOfLiquidityPool(uint256 _amountA, uint256 _priceA, uint256 _amountB, uint256 _priceB) private pure returns (uint256) {
        return (_amountA.mul(_priceA)).add(_amountB.mul(_priceB));
    }

    function _calcValueOf1LPToken(uint256 _totalValueOfLiquidityPool, uint256 _circulatingSupplyOfLPTokens) private pure returns (uint256) {
        return _totalValueOfLiquidityPool.div(_circulatingSupplyOfLPTokens);
    }

    function _getTokenPriceFromChainlink(address _priceFeedProxy) private view returns (uint256) {
        IChainlink pricefeed = IChainlink(_priceFeedProxy);
        (, int256 price, , ,) = pricefeed.latestRoundData();
        return uint256(price);
    }

    function _getLPTokenPriceMove(uint256 oldPrice, uint256 newPrice) private pure returns (uint256, Price) {
        if (newPrice > oldPrice) {
            uint256 percInc = (newPrice.sub(oldPrice)).mul(DENOMINATOR).div(oldPrice);
            return (percInc, Price.INCREASE);
        } else {
            uint256 percDec = (oldPrice.sub(newPrice)).mul(DENOMINATOR).div(oldPrice);
            return (percDec, Price.DECREASE);
        }
    }

    /// @notice Get total pool in ETH (18 decimals)
    function getTotalPool() public view returns (uint256) {
        return _poolHBTCWBTC.add(_poolWBTCETH).add(_poolDPIETH).add(_poolDAIETH);
    }

    /// @param _amount WETH to transfer
    function _splitYieldFees(uint256 _amount) private {
        WETH.withdraw(_amount);
        admin.call{value: (address(this).balance).mul(4).div(10)}("");
        treasuryWallet.call{value: (address(this).balance).mul(4).div(10)}("");
        communityWallet.call{value: (address(this).balance).mul(2).div(10)}("");
    }

    function _updatePoolForPriceChange() private {
    // function _updatePoolForPriceChange() public {
        // (uint256 _clpTokenPriceHBTC, uint256 _pSlpTokenPriceWBTC, uint256 _slpTokenPriceDPI, uint256 _pSlpTokenPriceDAI) = _getLPTokenPrice();
        (uint256 _clpTokenPriceHBTC, uint256 _pSlpTokenPriceWBTC, uint256 _slpTokenPriceDPI, uint256 _pSlpTokenPriceDAI) = _getLPTokenPriceTemp(); // Temporarily for testing purpose
        // HBTC/WBTC
        (uint256 _priceMovePercClp, Price _priceMoveDrClp) = _getLPTokenPriceMove(_HBTCWBTCLPTokenPrice, _clpTokenPriceHBTC);
        if (_priceMoveDrClp == Price.INCREASE) {
            _poolHBTCWBTC = _poolHBTCWBTC.add(_poolHBTCWBTC.mul(_priceMovePercClp).div(DENOMINATOR));
        } else {
            _poolHBTCWBTC = _poolHBTCWBTC.sub(_poolHBTCWBTC.mul(_priceMovePercClp).div(DENOMINATOR));
        }
        // WBTC/ETH
        (uint256 _priceMovePercPslpWBTC, Price _priceMoveDrPslpWBTC) = _getLPTokenPriceMove(_WBTCETHLPTokenPrice, _pSlpTokenPriceWBTC);
        if (_priceMoveDrPslpWBTC == Price.INCREASE) {
            _poolWBTCETH = _poolWBTCETH.add(_poolWBTCETH.mul(_priceMovePercPslpWBTC).div(DENOMINATOR));
        } else {
            _poolWBTCETH = _poolWBTCETH.sub(_poolWBTCETH.mul(_priceMovePercPslpWBTC).div(DENOMINATOR));
        }
        // DPI/ETH
        (uint256 _priceMovePercSlp, Price _priceMoveDrSlp) = _getLPTokenPriceMove(_DPIETHLPTokenPrice, _slpTokenPriceDPI);
        if (_priceMoveDrSlp == Price.INCREASE) {
            _poolDPIETH = _poolDPIETH.add(_poolDPIETH.mul(_priceMovePercSlp).div(DENOMINATOR));
        } else {
            _poolDPIETH = _poolDPIETH.sub(_poolDPIETH.mul(_priceMovePercSlp).div(DENOMINATOR));
        }
        // DAI/ETH
        (uint256 _priceMovePercPslpDAI, Price _priceMoveDrPslpDAI) = _getLPTokenPriceMove(_DAIETHLPTokenPrice, _pSlpTokenPriceDAI);
        if (_priceMoveDrPslpDAI == Price.INCREASE) {
            _poolDAIETH = _poolDAIETH.add(_poolDAIETH.mul(_priceMovePercPslpDAI).div(DENOMINATOR));
        } else {
            _poolDAIETH = _poolDAIETH.sub(_poolDAIETH.mul(_priceMovePercPslpDAI).div(DENOMINATOR));
        }
        // Update new price
        _HBTCWBTCLPTokenPrice = _clpTokenPriceHBTC;
        _WBTCETHLPTokenPrice = _pSlpTokenPriceWBTC;
        _DPIETHLPTokenPrice = _slpTokenPriceDPI;
        _DAIETHLPTokenPrice = _pSlpTokenPriceDAI;

        // Check % composition (use in testing only)
        // console.log(_poolHBTCWBTC.mul(DENOMINATOR).div(getTotalPool()));
        // console.log(_poolWBTCETH.mul(DENOMINATOR).div(getTotalPool()));
        // console.log(_poolDPIETH.mul(DENOMINATOR).div(getTotalPool()));
        // console.log(_poolDAIETH.mul(DENOMINATOR).div(getTotalPool()));
    }

    function _updatePoolForProvideLiquidity(uint256 _totalPool) private {
        uint256 _poolHBTCWBTCTarget = (_totalPool.mul(WEIGHTS[0]).div(DENOMINATOR));
        uint256 _poolWBTCETHTarget = (_totalPool.mul(WEIGHTS[1]).div(DENOMINATOR));
        uint256 _poolDPIETHTarget = (_totalPool.mul(WEIGHTS[2]).div(DENOMINATOR));
        uint256 _poolDAIETHTarget = (_totalPool.mul(WEIGHTS[3]).div(DENOMINATOR));
        // If there is no negative value(need to remove liquidity from farm in order to drive back the composition)
        // We proceed with split yield into 4 farms and drive composition back to target
        // Else, we put all the yield into the farm that is furthest from target composition
        if (
            _poolHBTCWBTCTarget > _poolHBTCWBTC &&
            _poolWBTCETHTarget > _poolWBTCETH &&
            _poolDPIETHTarget > _poolDPIETH &&
            _poolDAIETHTarget > _poolDAIETH
        ) {
            // Reinvest yield into Curve HBTC/WBTC
            uint256 _reinvestHBTCWBTCAmt = _poolHBTCWBTCTarget.sub(_poolHBTCWBTC);
            _reinvestHBTCWBTC(_reinvestHBTCWBTCAmt);
            // Reinvest yield into Pickle WBTC/ETH
            uint256 _reinvestWBTCETHAmt = _poolWBTCETHTarget.sub(_poolWBTCETH);
            _reinvestWBTCETH(_reinvestWBTCETHAmt);
            // Reinvest yield into Sushiswap Onsen DPI/ETH
            uint256 _reinvestDPIETHAmt = _poolDPIETHTarget.sub(_poolDPIETH);
            _reinvestDPIETH(_reinvestDPIETHAmt);
            // Reinvest yield into Pickle DAI/ETH
            uint256 _reinvestDAIETHAmt = _poolDAIETHTarget.sub(_poolDAIETH);
            _reinvestDAIETH(_reinvestDAIETHAmt);
        } else {
            // Put all the yield into the farm that is furthest from target composition
            uint256 _furthest;
            uint256 _farmIndex;
            // console.log(_poolHBTCWBTCTarget, _poolHBTCWBTC);
            // console.log(_poolWBTCETHTarget, _poolWBTCETH);
            // console.log(_poolDPIETHTarget, _poolDPIETH);
            // console.log(_poolDAIETHTarget, _poolDAIETH);
            // Find out the farm that is furthest from target composition
            if (_poolHBTCWBTCTarget > _poolHBTCWBTC) {
                uint256 _diff = _poolHBTCWBTCTarget.sub(_poolHBTCWBTC);
                if (_diff > _furthest) {
                    _furthest = _diff;
                    _farmIndex = 0;
                }
            }
            if (_poolWBTCETHTarget > _poolWBTCETH) {
                uint256 _diff = _poolWBTCETHTarget.sub(_poolWBTCETH);
                if (_diff > _furthest) {
                    _furthest = _diff;
                    _farmIndex = 1;
                }
            }
            if (_poolDPIETHTarget > _poolDPIETH) {
                uint256 _diff = _poolDPIETHTarget.sub(_poolDPIETH);
                if (_diff > _furthest) {
                    _furthest = _diff;
                    _farmIndex = 2;
                }
            }
            if (_poolDAIETHTarget > _poolDAIETH) {
                uint256 _diff = _poolDAIETHTarget.sub(_poolDAIETH);
                if (_diff > _furthest) {
                    _furthest = _diff;
                    _farmIndex = 3;
                }
            }
            // Put all the yield into the chosen farm
            if (_farmIndex == 0) {
                _reinvestHBTCWBTC(_furthest);
            } else if (_farmIndex == 1) {
                _reinvestWBTCETH(_furthest);
            } else if (_farmIndex == 2) {
                _reinvestDPIETH(_furthest);
            } else {
                _reinvestDAIETH(_furthest);
            }
        }
    }

    function _reinvestHBTCWBTC(uint256 _amount) private {
        uint256[] memory _amounts = _swapExactTokensForTokens(address(WETH), address(WBTC), _amount);
        if (_amounts[1] > 0) {
            cPairs.add_liquidity([0, _amounts[1]], 0);
            gaugeC.deposit(clpToken.balanceOf(address(this)));
            _poolHBTCWBTC = _poolHBTCWBTC.add(_amount);
        }
    }

    function _reinvestWBTCETH(uint256 _amount) private {
        uint256 _amountIn = _amount.mul(1).div(2);
        uint256[] memory _amounts = _swapExactTokensForTokens(address(WETH), address(WBTC), _amountIn);
        if (_amounts[1] > 0) {
            (uint256 amountA, uint256 amountB, uint256 liquidity) = router.addLiquidity(
                address(WBTC), address(WETH), 
                _amounts[1], _amountIn,
                0, 0,
                address(this), block.timestamp
            );
            pickleJarWBTC.deposit(slpWBTC.balanceOf(address(this)));
            gaugeP_WBTC.deposit(pickleJarWBTC.balanceOf(address(this)));
            _poolWBTCETH = _poolWBTCETH.add(_amount);
        }
    }

    function _reinvestDPIETH(uint256 _amount) private {
        uint256 _amountIn = _amount.mul(1).div(2);
        uint256[] memory _amounts = _swapExactTokensForTokens(address(WETH), address(DPI), _amountIn);
        if (_amounts[1] > 0) {
            (uint256 amountA, uint256 amountB, uint256 liquidity) = router.addLiquidity(
                address(DPI), address(WETH), 
                _amounts[1], _amountIn,
                0, 0,
                address(this), block.timestamp
            );
            masterChef.deposit(42, slpDPI.balanceOf(address(this))); // include slpDPI that withdraw at yield
            _poolDPIETH = _poolDPIETH.add(_amount);
        }
    }

    function _reinvestDAIETH(uint256 _amount) private {
        uint256 _amountIn = _amount.mul(1).div(2);
        uint256[] memory _amounts = _swapExactTokensForTokens(address(WETH), address(DAI), _amountIn);
        if (_amounts[1] > 0) {
            (uint256 amountA, uint256 amountB, uint256 liquidity) = router.addLiquidity(
                address(DAI), address(WETH), 
                _amounts[1], _amountIn,
                0, 0,
                address(this), block.timestamp
            );
            pickleJarDAI.deposit(slpDAI.balanceOf(address(this)));
            gaugeP_DAI.deposit(pickleJarDAI.balanceOf(address(this)));
            _poolDAIETH = _poolDAIETH.add(_amount);
        }
    }

    /// @param _amount Amount to withdraw in ETH
    function withdraw(uint256 _amount) external {
        uint256 _WETHAmtBefore = WETH.balanceOf(address(this));
        uint256 _shares = _amount.mul(1e18).div(getTotalPool());
        
        // Withdraw from Curve HBTC/WBTC
        _withdrawCurve(_poolHBTCWBTC.mul(_shares).div(1e18));
        // Withdraw from Pickle WBTC/ETH
        _withdrawPickleWBTC(_poolWBTCETH.mul(_shares).div(1e18));
        // Withdraw from Sushiswap DPI/ETH
        _withdrawSushiswap(_poolDPIETH.mul(_shares).div(1e18));
        // Withdraw from Pickle DAI/ETH
        _withdrawPickleDAI(_poolDAIETH.mul(_shares).div(1e18));

        _swapAllToETH();
        WETH.safeTransfer(msg.sender, (WETH.balanceOf(address(this))).sub(_WETHAmtBefore));
    }

    /// @param _amount Amount to withdraw in ETH
    function _withdrawCurve(uint256 _amount) private {
        uint256 _shares = _amount.mul(1e18).div(_poolHBTCWBTC);
        uint256 _totalClpToken = gaugeC.balanceOf(address(this));
        uint256 _clpTokenShare = _totalClpToken.mul(_shares).div(1e18);
        gaugeC.withdraw(_clpTokenShare);
        cPairs.remove_liquidity_one_coin(_clpTokenShare, 1, 0);
        _poolHBTCWBTC = _poolHBTCWBTC.sub(_amount);
    }

    function _withdrawPickleWBTC(uint256 _amount) private {
        uint256 _shares = _amount.mul(1e18).div(_poolWBTCETH);
        uint256 _totalPlpToken = gaugeP_WBTC.balanceOf(address(this));
        uint256 _plpTokenShare = _totalPlpToken.mul(_shares).div(1e18);
        gaugeP_WBTC.withdraw(_plpTokenShare);
        pickleJarWBTC.withdraw(_plpTokenShare);
        router.removeLiquidity(address(WBTC), address(WETH), slpWBTC.balanceOf(address(this)), 0, 0, address(this), block.timestamp);
        _poolWBTCETH = _poolWBTCETH.sub(_amount);
    }

    function _withdrawSushiswap(uint256 _amount) private {
        uint256 _shares = _amount.mul(1e18).div(_poolDPIETH);
        (uint256 _totalSlpToken,) = masterChef.userInfo(42, address(this));
        uint256 _slpTokenShare = _totalSlpToken.mul(_shares).div(1e18);
        masterChef.withdraw(42, _slpTokenShare);
        router.removeLiquidity(address(DPI), address(WETH), _slpTokenShare, 0, 0, address(this), block.timestamp);
        _poolDPIETH = _poolDPIETH.sub(_amount);
    }

    function _withdrawPickleDAI(uint256 _amount) private {
        uint256 _shares = _amount.mul(1e18).div(_poolDAIETH);
        uint256 _totalPlpToken = gaugeP_DAI.balanceOf(address(this));
        uint256 _plpTokenShare = _totalPlpToken.mul(_shares).div(1e18);
        gaugeP_DAI.withdraw(_plpTokenShare);
        pickleJarDAI.withdraw(_plpTokenShare);
        router.removeLiquidity(address(DAI), address(WETH), slpDAI.balanceOf(address(this)), 0, 0, address(this), block.timestamp);
        _poolDAIETH = _poolDAIETH.sub(_amount);
    }

    function _swapAllToETH() private {
        _swapExactTokensForTokens(address(WBTC), address(WETH), WBTC.balanceOf(address(this)));
        _swapExactTokensForTokens(address(DPI), address(WETH), DPI.balanceOf(address(this)));
        _swapExactTokensForTokens(address(DAI), address(WETH), DAI.balanceOf(address(this)));
    }

    function setAdmin(address _admin) external onlyVault {
        admin = _admin;
    }

    function setPercCRVToLock(uint256 _amount) external onlyOwner {
        require(_amount < DENOMINATOR, "Invalid percentage");
        curveSplit[1] = _amount;
        curveSplit[0] = DENOMINATOR.sub(_amount);
    }
}