// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IYearn is IERC20 {
  function calcPoolValueInToken() external view returns (uint256);
  function deposit(uint256 _amount) external;
  function withdraw(uint256 _shares) external;
}