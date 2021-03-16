// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface IStrategy {
    function deposit(uint256) external;

    function withdraw(uint256) external;

    function refund(uint256) external;

    function balanceOf(address) external view returns (uint256);

    function pool() external view returns (uint256);
}
