// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external returns (uint256 amountOut);
}

contract ZapReward {
    using SafeERC20 for IERC20;

    address public strategy;
    ISwapRouter private _uniV3 = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    IERC20 private _WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 private _AAVE = IERC20(0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9);

    constructor(address _strategy) {
        strategy = _strategy;

        _WETH.safeApprove(address(_uniV3), type(uint256).max);
        _AAVE.safeApprove(address(_uniV3), type(uint256).max);
    }

    function swapRewardTokenToDAI(address _tokenAddr) external returns (uint256) {
        IERC20 _token = IERC20(_tokenAddr);
        uint256 _tokenBalance = _token.balanceOf(address(strategy));
        _token.safeTransferFrom(address(strategy), address(this), _tokenBalance);
        if (_token.allowance(address(this), address(_uniV3)) == 0) {
            _token.safeApprove(address(_uniV3), type(uint256).max);
        }

        if (_tokenAddr == 0x4da27a545c0c5B758a6BA100e3a049001de870f5) { // stkAAVE
            address _AAVEAddr = 0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9;
            uint256 _AAVEBalance = _uniV3.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: _tokenAddr,
                    tokenOut: _AAVEAddr,
                    fee: 10000,
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: _tokenBalance,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                })
            );

            _uniV3.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: _AAVEAddr,
                    tokenOut: address(_WETH),
                    fee: 3000,
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: _AAVEBalance,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                })
            );
        } else {
            _uniV3.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: _tokenAddr,
                    tokenOut: address(_WETH),
                    fee: 10000,
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: _tokenBalance,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                })
            );
        }

        uint256 _amountOutDAI = _uniV3.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(_WETH),
                tokenOut: 0x6B175474E89094C44Da98b954EedeAC495271d0F, // DAI
                fee: 500,
                recipient: address(strategy),
                deadline: block.timestamp,
                amountIn: _WETH.balanceOf(address(this)),
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );

        return _amountOutDAI;
    }
}