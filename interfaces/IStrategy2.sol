// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface IStrategy2 {
    function deposit(uint256) external;

    function withdraw(uint256) external returns (uint256);

    function refund(uint256) external;

    function balanceOf(address) external view returns (uint256);

    function pool() external view returns (uint256);

    function getPseudoPool() external view returns (uint256);

    function invest(uint256) external;
}
