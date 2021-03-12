// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

interface IDaoVault {
  function totalSupply() external view returns (uint256);
  function balanceOf(address _address) external view returns (uint256); 
}