// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./ICERC20.sol";

interface IComptroller {
    function claimComp(address, ICERC20[] memory) external;
}
