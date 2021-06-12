// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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

    function getAmountsIn(uint amountOut, address[] memory path) external view returns (uint[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint[] memory amounts);
}

interface IChainlink {
    function latestAnswer() external view returns (int256);
}

contract CubanApeStrategy is Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 private constant _WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); // 18 decimals
    ISushiSwap private constant _sSwap = ISushiSwap(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);

    // Farms
    IERC20 private constant _renDOGE = IERC20(0x3832d2F059E55934220881F831bE501D180671A7); // 8 decimals
    IERC20 private constant _MATIC = IERC20(0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0); // 18 decimals
    IERC20 private constant _AAVE = IERC20(0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9); // 18 decimals
    IERC20 private constant _SUSHI = IERC20(0x6B3595068778DD592e39A122f4f5a5cF09C90fE2); // 18 decimals
    IERC20 private constant _AXS = IERC20(0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b); // 18 decimals
    IERC20 private constant _INJ = IERC20(0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30); // 18 decimals
    IERC20 private constant _ALCX = IERC20(0xdBdb4d16EdA451D0503b854CF79D55697F90c8DF); // 18 decimals

    // Others
    address public vault;
    uint256[] public weights; // [renDOGE, MATIC, AAVE, SUSHI, AXS, INJ, ALCX]
    uint256 private constant DENOMINATOR = 10000;
    bool public isVesting;

    event AmtToInvest(uint256 _amount); // In ETH
    // composition in ETH: renDOGE, MATIC, AAVE, SUSHI, AXS, INJ, ALCX
    event CurrentComposition(uint256, uint256, uint256, uint256, uint256, uint256, uint256);
    event TargetComposition(uint256, uint256, uint256, uint256, uint256, uint256, uint256);

    modifier onlyVault {
        require(msg.sender == vault, "Only vault");
        _;
    }

    constructor(uint256[] memory _weights) {
        weights = _weights;

        _WETH.safeApprove(address(_sSwap), type(uint256).max);
        _renDOGE.safeApprove(address(_sSwap), type(uint256).max);
        _MATIC.safeApprove(address(_sSwap), type(uint256).max);
        _AAVE.safeApprove(address(_sSwap), type(uint256).max);
        _SUSHI.safeApprove(address(_sSwap), type(uint256).max);
        _AXS.safeApprove(address(_sSwap), type(uint256).max);
        _INJ.safeApprove(address(_sSwap), type(uint256).max);
        _ALCX.safeApprove(address(_sSwap), type(uint256).max);
    }

    /// @notice Function to set vault address that interact with this contract. This function can only execute once when deployment.
    /// @param _vault Address of vault contract 
    function setVault(address _vault) external onlyOwner {
        require(vault == address(0), "Vault set");
        vault = _vault;
    }

    /// @notice Function to invest ETH into farms
    /// @param _amount Amount to invest in ETH
    function invest(uint256 _amount) external onlyVault {
        _WETH.safeTransferFrom(address(vault), address(this), _amount);
        emit AmtToInvest(_amount);

        // Due to the stack too deep error, pools are present in array
        uint256[] memory _pools = getFarmsPool();
        uint256 _totalPool = _amount.add(_getTotalPool());
        // Calculate target composition for each farm
        uint256[] memory _poolsTarget = new uint256[](7);
        for (uint256 _i=0 ; _i<7 ; _i++) {
            _poolsTarget[_i] = _totalPool.mul(weights[_i]).div(DENOMINATOR);
        }
        emit CurrentComposition(_pools[0], _pools[1], _pools[2], _pools[3], _pools[4], _pools[5], _pools[6]);
        emit TargetComposition(_poolsTarget[0], _poolsTarget[1], _poolsTarget[2], _poolsTarget[3], _poolsTarget[4], _poolsTarget[5], _poolsTarget[6]);
        // If there is no negative value(need to swap out from farm in order to drive back the composition)
        // We proceed with invest funds into 7 farms and drive composition back to target
        // Else, we invest all the funds into the farm that is furthest from target composition
        if (
            _poolsTarget[0] > _pools[0] &&
            _poolsTarget[1] > _pools[1] &&
            _poolsTarget[2] > _pools[2] &&
            _poolsTarget[3] > _pools[3] &&
            _poolsTarget[4] > _pools[4] &&
            _poolsTarget[5] > _pools[5] &&
            _poolsTarget[6] > _pools[6]
        ) {
            // Invest ETH into renDOGE
            _invest(_poolsTarget[0].sub(_pools[0]), _renDOGE);
            // Invest ETH into MATIC
            _invest(_poolsTarget[1].sub(_pools[1]), _MATIC);
            // Invest ETH into AAVE
            _invest(_poolsTarget[2].sub(_pools[2]), _AAVE);
            // Invest ETH into SUSHI
            _invest(_poolsTarget[3].sub(_pools[3]), _SUSHI);
            // Invest ETH into AXS
            _invest(_poolsTarget[4].sub(_pools[4]), _AXS);
            // Invest ETH into INJ
            _invest(_poolsTarget[5].sub(_pools[5]), _INJ);
            // Invest ETH into ALCX
            _invest(_poolsTarget[6].sub(_pools[6]), _ALCX);
        } else {
            // Invest all the funds to the farm that is furthest from target composition
            uint256 _furthest;
            uint256 _farmIndex;
            uint256 _diff;
            // 1. Find out the farm that is furthest from target composition
            if (_poolsTarget[0] > _pools[0]) {
                _furthest = _poolsTarget[0].sub(_pools[0]);
                _farmIndex = 0;
            }
            if (_poolsTarget[1] > _pools[1]) {
                _diff = _poolsTarget[1].sub(_pools[1]);
                if (_diff > _furthest) {
                    _furthest = _diff;
                    _farmIndex = 1;
                }
            }
            if (_poolsTarget[2] > _pools[2]) {
                _diff = _poolsTarget[2].sub(_pools[2]);
                if (_diff > _furthest) {
                    _furthest = _diff;
                    _farmIndex = 2;
                }
            }
            if (_poolsTarget[3] > _pools[3]) {
                _diff = _poolsTarget[3].sub(_pools[3]);
                if (_diff > _furthest) {
                    _furthest = _diff;
                    _farmIndex = 3;
                }
            }
            if (_poolsTarget[4] > _pools[4]) {
                _diff = _poolsTarget[4].sub(_pools[4]);
                if (_diff > _furthest) {
                    _furthest = _diff;
                    _farmIndex = 4;
                }
            }
            if (_poolsTarget[5] > _pools[5]) {
                _diff = _poolsTarget[5].sub(_pools[5]);
                if (_diff > _furthest) {
                    _furthest = _diff;
                    _farmIndex = 5;
                }
            }
            if (_poolsTarget[6] > _pools[6]) {
                _diff = _poolsTarget[6].sub(_pools[6]);
                if (_diff > _furthest) {
                    _furthest = _diff;
                    _farmIndex = 6;
                }
            }
            // 2. Put all the yield into the farm that is furthest from target composition
            if (_farmIndex == 0) {
                _invest(_amount, _renDOGE);
            } else if (_farmIndex == 1) {
                _invest(_amount, _MATIC);
            } else if (_farmIndex == 2) {
                _invest(_amount, _AAVE);
            } else if (_farmIndex == 3) {
                _invest(_amount, _SUSHI);
            } else if (_farmIndex == 4) {
                _invest(_amount, _AXS);
            } else if (_farmIndex == 5) {
                _invest(_amount, _INJ);
            } else {
                _invest(_amount, _ALCX);
            }
        }
    }

    /// @notice Function to invest funds into farm
    /// @param _amount Amount to invest in ETH
    /// @param _farm Farm to invest
    function _invest(uint256 _amount, IERC20 _farm) private {
        _swapExactTokensForTokens(address(_WETH), address(_farm), _amount);
    }

    /// @notice Function to withdraw Stablecoins from farms if withdraw amount > amount keep in vault
    /// @param _amount Amount to withdraw in ETH
    /// @return Amount of actual withdraw in ETH
    function withdraw(uint256 _amount) external onlyVault returns (uint256) {
        uint256 _withdrawAmt;
        if (!isVesting) {
            uint256 _totalPool = _getTotalPool();
            _swapExactTokensForTokens(address(_renDOGE), address(_WETH), (_renDOGE.balanceOf(address(this))).mul(_amount).div(_totalPool));
            _swapExactTokensForTokens(address(_MATIC), address(_WETH), (_MATIC.balanceOf(address(this))).mul(_amount).div(_totalPool));
            _swapExactTokensForTokens(address(_AAVE), address(_WETH), (_AAVE.balanceOf(address(this))).mul(_amount).div(_totalPool));
            _swapExactTokensForTokens(address(_SUSHI), address(_WETH), (_SUSHI.balanceOf(address(this))).mul(_amount).div(_totalPool));
            _swapExactTokensForTokens(address(_AXS), address(_WETH), (_AXS.balanceOf(address(this))).mul(_amount).div(_totalPool));
            _swapExactTokensForTokens(address(_INJ), address(_WETH), (_INJ.balanceOf(address(this))).mul(_amount).div(_totalPool));
            _swapExactTokensForTokens(address(_ALCX), address(_WETH), (_ALCX.balanceOf(address(this))).mul(_amount).div(_totalPool));
            _withdrawAmt = _WETH.balanceOf(address(this));
        } else {
            _withdrawAmt = _amount;
        }
        _WETH.safeTransfer(address(vault), _withdrawAmt);
        return _withdrawAmt;
    }

    /// @notice Function to release WETH to vault by swapping out farm
    /// @param _amount Amount of WETH to release
    /// @param _farmIndex Type of farm to swap out (0: renDOGE, 1: MATIC, 2: AAVE, 3: SUSHI, 4: AXS, 5: INJ, 6: ALCX)
    function releaseETHToVault(uint256 _amount, uint256 _farmIndex) external onlyVault returns (uint256) {
        if (_farmIndex == 0) {
            _swapTokensForExactTokens(address(_renDOGE), address(_WETH), _amount);
        } else if (_farmIndex == 1) {
            _swapTokensForExactTokens(address(_MATIC), address(_WETH), _amount);
        } else if (_farmIndex == 2) {
            _swapTokensForExactTokens(address(_AAVE), address(_WETH), _amount);
        } else if (_farmIndex == 3) {
            _swapTokensForExactTokens(address(_SUSHI), address(_WETH), _amount);
        } else if (_farmIndex == 4) {
            _swapTokensForExactTokens(address(_AXS), address(_WETH), _amount);
        } else if (_farmIndex == 5) {
            _swapTokensForExactTokens(address(_INJ), address(_WETH), _amount);
        } else {
            _swapTokensForExactTokens(address(_ALCX), address(_WETH), _amount);
        }
        uint256 _WETHBalance = _WETH.balanceOf(address(this));
        _WETH.safeTransfer(address(vault), _WETHBalance);
        return _WETHBalance;
    }

    /// @notice Function to withdraw all funds from all farms and swap to WETH
    function emergencyWithdraw() external onlyVault {
        _swapExactTokensForTokens(address(_renDOGE), address(_WETH), _renDOGE.balanceOf(address(this)));
        _swapExactTokensForTokens(address(_MATIC), address(_WETH), _MATIC.balanceOf(address(this)));
        _swapExactTokensForTokens(address(_AAVE), address(_WETH), _AAVE.balanceOf(address(this)));
        _swapExactTokensForTokens(address(_SUSHI), address(_WETH), _SUSHI.balanceOf(address(this)));
        _swapExactTokensForTokens(address(_AXS), address(_WETH), _AXS.balanceOf(address(this)));
        _swapExactTokensForTokens(address(_INJ), address(_WETH), _INJ.balanceOf(address(this)));
        _swapExactTokensForTokens(address(_ALCX), address(_WETH), _ALCX.balanceOf(address(this)));

        isVesting = true;
    }

    /// @notice Function to invest WETH into farms
    function reinvest() external onlyVault {
        isVesting = false;

        uint256 _WETHBalance = _WETH.balanceOf(address(this));
        _invest(_WETHBalance.mul(weights[0]).div(DENOMINATOR), _renDOGE);
        _invest(_WETHBalance.mul(weights[1]).div(DENOMINATOR), _MATIC);
        _invest(_WETHBalance.mul(weights[2]).div(DENOMINATOR), _AAVE);
        _invest(_WETHBalance.mul(weights[3]).div(DENOMINATOR), _SUSHI);
        _invest(_WETHBalance.mul(weights[4]).div(DENOMINATOR), _AXS);
        _invest(_WETHBalance.mul(weights[5]).div(DENOMINATOR), _INJ);
        _invest(_WETH.balanceOf(address(this)), _ALCX);
    }

    /// @notice Function to approve vault to migrate funds from this contract to new strategy contract
    function approveMigrate() external onlyOwner {
        require(isVesting, "Not in vesting state");
        _WETH.safeApprove(address(vault), type(uint256).max);
    }

    /// @notice Function to set weight of farms
    /// @param _weights Array with new weight(percentage) of farms (7 elements, DENOMINATOR = 10000)
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

    /// @notice Function to swap tokens with Sushi
    /// @param _tokenA Token to be swapped
    /// @param _tokenB Token to be received
    /// @param _amountOut Amount of token to be received
    /// @return _amounts Array that contains amounts of swapped tokens
    function _swapTokensForExactTokens(address _tokenA, address _tokenB, uint256 _amountOut) private returns (uint256[] memory _amounts) {
        address[] memory _path = _getPath(_tokenA, _tokenB);
        uint256[] memory _amountsOut = _sSwap.getAmountsIn(_amountOut, _path);
        if (_amountsOut[1] > 0) {
            _amounts = _sSwap.swapTokensForExactTokens(_amountOut, type(uint256).max, _path, address(this), block.timestamp);
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

    /// @notice Get total pool in USD (sum of 7 tokens)
    /// @return Total pool in USD (6 decimals)
    function getTotalPoolInUSD() public view returns (uint256) {
        IChainlink _pricefeed = IChainlink(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);  // ETH/USD
        return _getTotalPool().mul(uint256(_pricefeed.latestAnswer())).div(1e20);
    }

    /// @notice Get total pool (sum of 7 tokens)
    /// @return Total pool in ETH
    function _getTotalPool() private view returns (uint256) {
        if (!isVesting) {
            uint256[] memory _pools = getFarmsPool();
            return _pools[0].add(_pools[1]).add(_pools[2]).add(_pools[3]).add(_pools[4]).add(_pools[5]).add(_pools[6]);
        } else {
            return _WETH.balanceOf(address(this));
        }
    }

    /// @notice Get current farms pool (current composition)
    /// @return Each farm pool in ETH in an array
    function getFarmsPool() public view returns (uint256[] memory) {
        uint256[] memory _pools = new uint256[](7);
        // renDOGE
        uint256[] memory _renDOGEPrice = _sSwap.getAmountsOut(1e8, _getPath(address(_renDOGE), address(_WETH)));
        _pools[0] = (_renDOGE.balanceOf(address(this))).mul(_renDOGEPrice[1]).div(1e8);
        // MATIC
        uint256[] memory _MATICPrice = _sSwap.getAmountsOut(1e18, _getPath(address(_MATIC), address(_WETH)));
        _pools[1] = (_MATIC.balanceOf(address(this))).mul(_MATICPrice[1]).div(1e18);
        // AAVE
        uint256[] memory _AAVEPrice = _sSwap.getAmountsOut(1e18, _getPath(address(_AAVE), address(_WETH)));
        _pools[2] = (_AAVE.balanceOf(address(this))).mul(_AAVEPrice[1]).div(1e18);
        // SUSHI
        uint256[] memory _SUSHIPrice = _sSwap.getAmountsOut(1e18, _getPath(address(_SUSHI), address(_WETH)));
        _pools[3] = (_SUSHI.balanceOf(address(this))).mul(_SUSHIPrice[1]).div(1e18);
        // AXS
        uint256[] memory _AXSPrice = _sSwap.getAmountsOut(1e18, _getPath(address(_AXS), address(_WETH)));
        _pools[4] = (_AXS.balanceOf(address(this))).mul(_AXSPrice[1]).div(1e18);
        // INJ
        uint256[] memory _INJPrice = _sSwap.getAmountsOut(1e18, _getPath(address(_INJ), address(_WETH)));
        _pools[5] = (_INJ.balanceOf(address(this))).mul(_INJPrice[1]).div(1e18);
        // ALCX
        uint256[] memory _ALCXPrice = _sSwap.getAmountsOut(1e18, _getPath(address(_ALCX), address(_WETH)));
        _pools[6] = (_ALCX.balanceOf(address(this))).mul(_ALCXPrice[1]).div(1e18);

        return _pools;
    }
}