// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ICurveSwap {
    function exchange(int128 i, int128 j, uint256 _dx, uint256 _min_dy) external;
}

interface IBalancerSwap {
    function getSpotPrice(address tokenIn, address tokenOut) external view returns (uint spotPrice);

    function swapExactAmountIn(
        address tokenIn,
        uint tokenAmountIn,
        address tokenOut,
        uint minAmountOut,
        uint maxPrice
    ) external returns (uint tokenAmountOut, uint spotPriceAfter);

    function swapExactAmountOut(
        address tokenIn,
        uint maxAmountIn,
        address tokenOut,
        uint tokenAmountOut,
        uint maxPrice
    ) external returns (uint tokenAmountIn, uint spotPriceAfter);
}

interface ISushiSwap {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint[] memory amounts);

    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint[] memory amounts);
}

interface IChainlink {
    function latestAnswer() external view returns (int256);
}

contract ElonApeStrategy is Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 private constant WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); // 18 decimals
    IERC20 private constant USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7); // 6 decimals
    IERC20 private constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48); // 6 decimals
    IERC20 private constant DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F); // 18 decimals
    IERC20 private constant sUSD = IERC20(0x57Ab1ec28D129707052df4dF418D58a2D46d5f51); // 18 decimals

    // DeXes
    ICurveSwap private constant _cSwap = ICurveSwap(0xA5407eAE9Ba41422680e2e00537571bcC53efBfD);
    IBalancerSwap private constant _bSwap = IBalancerSwap(0x055dB9AFF4311788264798356bbF3a733AE181c6);
    ISushiSwap private constant _sSwap = ISushiSwap(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);

    // Farms
    IERC20 private constant sTSLA = IERC20(0x918dA91Ccbc32B7a6A0cc4eCd5987bbab6E31e6D); // 18 decimals
    IERC20 private constant WBTC = IERC20(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599); // 8 decimals
    IERC20 private constant renDOGE = IERC20(0x3832d2F059E55934220881F831bE501D180671A7); // 8 decimals

    // Others
    address public vault;
    uint256[] public weights; // [sTSLA, WBTC, renDOGE]
    uint256 private constant DENOMINATOR = 10000;
    bool public isVesting;

    event AmtToInvest(uint256 _amount); // In USD (6 decimals)
    event CurrentComposition(uint256 _poolSTSLA, uint256 _poolWBTC, uint256 _poolRenDOGE); // in USD (6 decimals)
    event TargetComposition(uint256 _poolSTSLA, uint256 _poolWBTC, uint256 _poolRenDOGE); // in USD (6 decimals)

    modifier onlyVault {
        require(msg.sender == vault, "Only vault");
        _;
    }

    constructor(uint256[] memory _weights) {
        weights = _weights;

        // Curve
        USDT.safeApprove(address(_cSwap), type(uint256).max);
        USDC.safeApprove(address(_cSwap), type(uint256).max);
        DAI.safeApprove(address(_cSwap), type(uint256).max);
        sUSD.safeApprove(address(_cSwap), type(uint256).max);
        // Balancer
        sUSD.safeApprove(address(_bSwap), type(uint256).max);
        sTSLA.safeApprove(address(_bSwap), type(uint256).max);
        // Sushi
        USDT.safeApprove(address(_sSwap), type(uint256).max);
        USDC.safeApprove(address(_sSwap), type(uint256).max);
        DAI.safeApprove(address(_sSwap), type(uint256).max);
        WETH.safeApprove(address(_sSwap), type(uint256).max);
        WBTC.safeApprove(address(_sSwap), type(uint256).max);
        renDOGE.safeApprove(address(_sSwap), type(uint256).max);
    }

    /// @notice Function to set vault address that interact with this contract. This function can only execute once when deployment.
    /// @param _vault Address of vault contract 
    function setVault(address _vault) external onlyOwner {
        require(vault == address(0), "Vault set");
        vault = _vault;
    }

    /// @notice Function to invest Stablecoins into farms
    /// @param _amountUSDT 6 decimals
    /// @param _amountUSDC 6 decimals
    /// @param _amountDAI 18 decimals
    function invest(uint256 _amountUSDT, uint256 _amountUSDC, uint256 _amountDAI) external onlyVault {
        if (_amountUSDT > 0) {
            USDT.safeTransferFrom(address(vault), address(this), _amountUSDT);
        }
        if (_amountUSDC > 0) {
            USDC.safeTransferFrom(address(vault), address(this), _amountUSDC);
        }
        if (_amountDAI > 0) {
            DAI.safeTransferFrom(address(vault), address(this), _amountDAI);
        }
        uint256 _totalInvestInUSD = _amountUSDT.add(_amountUSDC).add(_amountDAI.div(1e12));
        require(_totalInvestInUSD > 0, "Not enough Stablecoin to invest");
        emit AmtToInvest(_totalInvestInUSD);

        (uint256 _poolSTSLA, uint256 _poolWBTC, uint256 _poolRenDOGE) = getFarmsPool();
        uint256 _totalPool = _poolSTSLA.add(_poolWBTC).add(_poolRenDOGE).add(_totalInvestInUSD);
        // Calculate target composition for each farm
        uint256 _poolSTSLATarget = _totalPool.mul(weights[0]).div(DENOMINATOR);
        uint256 _poolWBTCTarget = _totalPool.mul(weights[1]).div(DENOMINATOR);
        uint256 _poolRenDOGETarget = _totalPool.mul(weights[2]).div(DENOMINATOR);
        emit CurrentComposition(_poolSTSLA, _poolWBTC, _poolRenDOGE);
        emit TargetComposition(_poolSTSLATarget, _poolWBTCTarget, _poolRenDOGETarget);
        // If there is no negative value(need to swap out from farm in order to drive back the composition)
        // We proceed with invest funds into 3 farms and drive composition back to target
        // Else, we invest all the funds into the farm that is furthest from target composition
        if (
            _poolSTSLATarget > _poolSTSLA &&
            _poolWBTCTarget > _poolWBTC &&
            _poolRenDOGETarget > _poolRenDOGE
        ) {
            // Invest Stablecoins into sTSLA
            _investSTSLA(_poolSTSLATarget.sub(_poolSTSLA), _totalInvestInUSD);
            // WETH needed for _investWBTC() and _investRenDOGE() instead of Stablecoins
            // We can execute swap from Stablecoins to WETH in both function,
            // but since swapping is expensive, we swap it once and split WETH to these 2 functions
            uint256 _WETHBalance = _swapAllStablecoinsToWETH();
            // Get the ETH amount of USD to invest for WBTC and renDOGE
            uint256 _investWBTCAmtInUSD = _poolWBTCTarget.sub(_poolWBTC);
            uint256 _investRenDOGEAmtInUSD = _poolRenDOGETarget.sub(_poolRenDOGE);
            uint256 _investWBTCAmtInETH = _WETHBalance.mul(_investWBTCAmtInUSD).div(_investWBTCAmtInUSD.add(_investRenDOGEAmtInUSD));
            // Invest ETH into sTSLA
            _investWBTC(_investWBTCAmtInETH);
            // Invest ETH into renDOGE
            _investRenDOGE(_WETHBalance.sub(_investWBTCAmtInETH));
        } else {
            // Invest all the funds to the farm that is furthest from target composition
            uint256 _furthest;
            uint256 _farmIndex;
            uint256 _diff;
            // 1. Find out the farm that is furthest from target composition
            if (_poolSTSLATarget > _poolSTSLA) {
                _furthest = _poolSTSLATarget.sub(_poolSTSLA);
                _farmIndex = 0;
            }
            if (_poolWBTCTarget > _poolWBTC) {
                _diff = _poolWBTCTarget.sub(_poolWBTC);
                if (_diff > _furthest) {
                    _furthest = _diff;
                    _farmIndex = 1;
                }
            }
            if (_poolRenDOGETarget > _poolRenDOGE) {
                _diff = _poolRenDOGETarget.sub(_poolRenDOGE);
                if (_diff > _furthest) {
                    _furthest = _diff;
                    _farmIndex = 2;
                }
            }
            // 2. Put all the yield into the farm that is furthest from target composition
            if (_farmIndex == 0) {
                _investSTSLA(_totalInvestInUSD, _totalInvestInUSD);
            } else {
                uint256 _WETHBalance = _swapAllStablecoinsToWETH();
                if (_farmIndex == 1) {
                    _investWBTC(_WETHBalance);
                } else {
                    _investRenDOGE(_WETHBalance);
                }
            }
        }
    }

    /// @notice Function to swap funds into sTSLA
    /// @param _amount Amount to invest in sTSLA in USD (6 decimals)
    /// @param _totalInvestInUSD Total amount of USD to invest (6 decimals)
    function _investSTSLA(uint256 _amount, uint256 _totalInvestInUSD) private {
        // Swap Stablecoins to sUSD with Curve
        uint256 _USDTBalance = USDT.balanceOf(address(this));
        if (_USDTBalance > 1e6) { // Set minimum swap amount to avoid error
            _cSwap.exchange(2, 3, _USDTBalance.mul(_amount).div(_totalInvestInUSD), 0);
        }
        uint256 _USDCBalance = USDC.balanceOf(address(this));
        if (_USDCBalance > 1e6) {
            _cSwap.exchange(1, 3, _USDCBalance.mul(_amount).div(_totalInvestInUSD), 0);
        }
        uint256 _DAIBalance = DAI.balanceOf(address(this));
        if (_DAIBalance > 1e18) {
            _cSwap.exchange(0, 3, _DAIBalance.mul(_amount).div(_totalInvestInUSD), 0);
        }
        uint256 _sUSDBalance = sUSD.balanceOf(address(this));
        // Swap sUSD to sTSLA with Balancer
        _bSwap.swapExactAmountIn(address(sUSD), _sUSDBalance, address(sTSLA), 0, type(uint256).max);
    }

    /// @notice Function to swap funds into WBTC
    /// @param _amount Amount to invest in ETH
    function _investWBTC(uint256 _amount) private {
        _swapExactTokensForTokens(address(WETH), address(WBTC), _amount);
    }

    /// @notice Function to swap funds into renDOGE
    /// @param _amount Amount to invest in ETH
    function _investRenDOGE(uint256 _amount) private {
        _swapExactTokensForTokens(address(WETH), address(renDOGE), _amount);
    }

    /// @notice Function to swap all available Stablecoins to WETH
    /// @return Balance of received WETH
    function _swapAllStablecoinsToWETH() private returns (uint256) {
        uint256 _USDTBalance = USDT.balanceOf(address(this));
        if (_USDTBalance > 1e6) { // Set minimum swap amount to avoid error
            _swapExactTokensForTokens(address(USDT), address(WETH), _USDTBalance);
        }
        uint256 _USDCBalance = USDC.balanceOf(address(this));
        if (_USDCBalance > 1e6) {
            _swapExactTokensForTokens(address(USDC), address(WETH), _USDCBalance);
        }
        uint256 _DAIBalance = DAI.balanceOf(address(this));
        if (_DAIBalance > 1e18) {
            _swapExactTokensForTokens(address(DAI), address(WETH), _DAIBalance);
        }
        return WETH.balanceOf(address(this));
    }

    /// @notice Function to withdraw Stablecoins from farms if withdraw amount > amount keep in vault
    /// @param _amount Amount to withdraw in USD (6 decimals)
    /// @param _tokenIndex Type of Stablecoin to withdraw
    /// @return Amount of actual withdraw in USD (6 decimals)
    function withdraw(uint256 _amount, uint256 _tokenIndex) external onlyVault returns (uint256) {
        uint256 _totalPool = getTotalPool();
        // Determine type of Stablecoin to withdraw
        (IERC20 _token, int128 _curveIndex) = _determineTokenTypeAndCurveIndex(_tokenIndex);
        uint256 _withdrawAmt;
        if (!isVesting) {
            // Swap sTSLA to Stablecoin
            uint256 _sTSLAAmtToWithdraw = (sTSLA.balanceOf(address(this))).mul(_amount).div(_totalPool);
            _withdrawSTSLA(_sTSLAAmtToWithdraw, _curveIndex);
            // Swap WBTC to WETH
            uint256 _WBTCAmtToWithdraw = (WBTC.balanceOf(address(this))).mul(_amount).div(_totalPool);
            _swapExactTokensForTokens(address(WBTC), address(WETH), _WBTCAmtToWithdraw);
            // Swap renDOGE to WETH
            uint256 _renDOGEAmtToWithdraw = (renDOGE.balanceOf(address(this))).mul(_amount).div(_totalPool);
            _swapExactTokensForTokens(address(renDOGE), address(WETH), _renDOGEAmtToWithdraw);
            // Swap WETH to Stablecoin
            _swapExactTokensForTokens(address(WETH), address(_token), WETH.balanceOf(address(this)));
            _withdrawAmt = _token.balanceOf(address(this));
        } else {
            uint256 _withdrawAmtInETH = (WETH.balanceOf(address(this))).mul(_amount).div(_totalPool);
            // Swap WETH to Stablecoin
            uint256[] memory _amountsOut = _swapExactTokensForTokens(address(WETH), address(_token), _withdrawAmtInETH);
            _withdrawAmt = _amountsOut[1];
        }
        _token.safeTransfer(address(vault), _withdrawAmt);
        if (_token == DAI) { // To make consistency of 6 decimals return
            _withdrawAmt = _withdrawAmt.div(1e12);
        }
        return _withdrawAmt;
    }

    /// @param _amount Amount of sTSLA to withdraw (18 decimals)
    /// @param _curveIndex Index of Stablecoin to swap in Curve
    function _withdrawSTSLA(uint256 _amount, int128 _curveIndex) private {
        (uint256 _amountOut,) = _bSwap.swapExactAmountIn(address(sTSLA), _amount, address(sUSD), 0, type(uint256).max);
        _cSwap.exchange(3, _curveIndex, _amountOut, 0);
    }

    /// @notice Function to release Stablecoin to vault by swapping out farm
    /// @param _tokenIndex Type of Stablecoin to release (0 for USDT, 1 for USDC, 2 for DAI)
    /// @param _farmIndex Type of farm to swap out (0 for sTSLA, 1 for WBTC, 2 for renDOGE)
    /// @param _amount Amount of Stablecoin to release (6 decimals)
    function releaseStablecoinsToVault(uint256 _tokenIndex, uint256 _farmIndex, uint256 _amount) external onlyVault {
        // Determine type of Stablecoin to release
        (IERC20 _token, int128 _curveIndex) = _determineTokenTypeAndCurveIndex(_tokenIndex);
        // Swap out farm token to Stablecoin
        if (_farmIndex == 0) {
            _amount = _amount.mul(1e12);
            _bSwap.swapExactAmountOut(address(sTSLA), type(uint256).max, address(sUSD), _amount, type(uint256).max);
            _cSwap.exchange(3, _curveIndex, _amount, 0);
            _token.safeTransfer(address(vault), _token.balanceOf(address(this)));
        } else {
            if (_token == DAI) { // Follow DAI decimals
                _amount = _amount.mul(1e12);
            }
            // Get amount of WETH from Stablecoin input as amount out swapping from farm
            uint256[] memory _amountsOut = _sSwap.getAmountsOut(_amount, _getPath(address(_token), address(WETH)));
            IERC20 _farm;
            if (_farmIndex == 1) {
                _farm = WBTC;
            } else {
                _farm = renDOGE;
            }
            // Swap farm to exact amount of WETH above
            _sSwap.swapTokensForExactTokens(_amountsOut[1], type(uint256).max, _getPath(address(_farm), address(WETH)), address(this), block.timestamp);
            // Swap WETH to Stablecoin
            _sSwap.swapExactTokensForTokens(_amountsOut[1], 0, _getPath(address(WETH), address(_token)), address(vault), block.timestamp);
        }
    }

    /// @notice Function to withdraw all funds from all farms and swap to WETH
    function emergencyWithdraw() external onlyVault {
        // sTSLA -> sUSD -> USDT -> WETH
        _withdrawSTSLA(sTSLA.balanceOf(address(this)), 2);
        _swapExactTokensForTokens(address(USDT), address(WETH), USDT.balanceOf(address(this)));
        // WBTC -> WETH
        _swapExactTokensForTokens(address(WBTC), address(WETH), WBTC.balanceOf(address(this)));
        // renDOGE -> WETH
        _swapExactTokensForTokens(address(renDOGE), address(WETH), renDOGE.balanceOf(address(this)));

        isVesting = true;
    }

    /// @notice Function to invest WETH into farms
    function reinvest() external onlyVault {
        isVesting = false;
        uint256 _WETHBalance = WETH.balanceOf(address(this));
        // sTSLA (WETH -> USDT -> sUSD -> sTSLA)
        _swapExactTokensForTokens(address(WETH), address(USDT), _WETHBalance.mul(weights[0]).div(DENOMINATOR));
        _investSTSLA(1, 1); // Invest all avalaible Stablecoins
        // WBTC (WETH -> WBTC)
        _investWBTC(_WETHBalance.mul(weights[1]).div(DENOMINATOR));
        // renDOGE (WETH -> renDOGE)
        _investRenDOGE(WETH.balanceOf(address(this)));
    }

    /// @notice Function to approve vault to migrate funds from this contract to new strategy contract
    function approveMigrate() external onlyOwner {
        require(isVesting, "Not in vesting state");
        WETH.safeApprove(address(vault), type(uint256).max);
    }

    /// @notice Function to set weight of farms
    /// @param _weights Array with new weight(percentage) of farms (3 elements, DENOMINATOR = 10000)
    function setWeights(uint256[] memory _weights) external onlyVault {
        weights = _weights;
    }

    /// @notice Function to swap tokens with Sushi
    /// @param _tokenA Token to be swapped
    /// @param _tokenB Token to be received
    /// @param _amountIn Amount of token to be swapped
    /// @return _amounts Array that contains amounts of swapped tokens
    function _swapExactTokensForTokens(address _tokenA, address _tokenB, uint256 _amountIn) private returns (uint256[] memory _amounts) {
        address[] memory _path = _getPath(_tokenA, _tokenB);
        uint256[] memory _amountsOut = _sSwap.getAmountsOut(_amountIn, _path);
        if (_amountsOut[1] > 0) {
            _amounts = _sSwap.swapExactTokensForTokens(_amountIn, 0, _path, address(this), block.timestamp);
        }
    }

    /// @notice Function to get path for Sushi swap functions
    /// @param _tokenA Token to be swapped
    /// @param _tokenB Token to be received
    /// @return Array of addresses
    function _getPath(address _tokenA, address _tokenB) private pure returns (address[] memory) {
        address[] memory _path = new address[](2);
        _path[0] = _tokenA;
        _path[1] = _tokenB;
        return _path;
    }

    /// @notice Function to determine type of Stablecoin and Curve index for Stablecoin
    /// @param _tokenIndex Type of Stablecoin
    /// @return Type of Stablecoin in IERC20 and Curve index for Stablecoin
    function _determineTokenTypeAndCurveIndex(uint256 _tokenIndex) private pure returns (IERC20, int128) {
        IERC20 _token;
        int128 _curveIndex;
        if (_tokenIndex == 0) {
            _token = USDT;
            _curveIndex = 2;
        } else if (_tokenIndex == 1) {
            _token = USDC;
            _curveIndex = 1;
        } else {
            _token = DAI;
            _curveIndex = 0;
        }
        return (_token, _curveIndex);
    }

    /// @notice Function to get current price of ETH
    /// @return Current price of ETH in USD (8 decimals)
    function _getCurrentPriceOfETHInUSD() private view returns (uint256) {
        IChainlink _pricefeed = IChainlink(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
        return uint256(_pricefeed.latestAnswer());
    }

    /// @notice Get total pool (sum of 3 tokens)
    /// @return Total pool in USD (6 decimals)
    function getTotalPool() public view returns (uint256) {
        if (!isVesting) {
            (uint256 _poolSTSLA, uint256 _poolWBTC, uint256 _poolrenDOGE) = getFarmsPool();
            return _poolSTSLA.add(_poolWBTC).add(_poolrenDOGE);
        } else {
            uint256 _price = _getCurrentPriceOfETHInUSD();
            return (WETH.balanceOf(address(this))).mul(_price).div(1e20);
        }
    }

    /// @notice Get current farms pool (current composition)
    /// @return Each farm pool in USD (6 decimals)
    function getFarmsPool() public view returns (uint256, uint256, uint256) {
        uint256 _price = _getCurrentPriceOfETHInUSD();
        // sTSLA
        uint256 _sTSLAPriceInUSD = _bSwap.getSpotPrice(address(sUSD), address(sTSLA)); // 18 decimals
        uint256 _poolSTSLA = (sTSLA.balanceOf(address(this))).mul(_sTSLAPriceInUSD).div(1e30);
        // WBTC
        uint256[] memory _WBTCPriceInETH = _sSwap.getAmountsOut(1e8, _getPath(address(WBTC), address(WETH)));
        uint256 _poolWBTC = (WBTC.balanceOf(address(this))).mul(_WBTCPriceInETH[1].mul(_price)).div(1e28);
        // renDOGE
        uint256[] memory _renDOGEPriceInETH = _sSwap.getAmountsOut(1e8, _getPath(address(renDOGE), address(WETH)));
        uint256 _poolrenDOGE = (renDOGE.balanceOf(address(this))).mul(_renDOGEPriceInETH[1].mul(_price)).div(1e28);

        return (_poolSTSLA, _poolWBTC, _poolrenDOGE);
    }
}