// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICERC20 is IERC20 {
    function mint(uint256) external returns (uint256);

    function redeem(uint256) external returns (uint256);
}
