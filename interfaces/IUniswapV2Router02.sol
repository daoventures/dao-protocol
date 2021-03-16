// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface IUniswapV2Router02 {
    function getAmountsOut(uint256, address[] memory)
        external
        view
        returns (uint256[] memory);

    function swapExactTokensForTokens(
        uint256,
        uint256,
        address[] calldata,
        address,
        uint256
    ) external returns (uint256[] memory);
}
