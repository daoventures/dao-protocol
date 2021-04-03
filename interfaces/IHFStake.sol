// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface IHFStake {
    function stake(uint256) external;

    function withdraw(uint256) external;

    function getReward() external;

    function balanceOf(address) external view returns (uint256);

    function exit() external;
}
