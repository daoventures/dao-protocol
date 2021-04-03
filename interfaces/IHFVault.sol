// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IHFVault is IERC20Upgradeable {
    function deposit(uint256) external;

    function withdraw(uint256) external;
}
