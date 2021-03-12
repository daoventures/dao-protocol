// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

interface IStrategy {
    function deposit(uint256[] memory _amounts) external;
    function withdraw(uint256[] memory _shares) external;
    function refund(uint256 _shares) external;
    function balanceOf(address _address) external view returns (uint256);
}