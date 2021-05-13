"use strict";

const { ethers } = require("hardhat")
const BigNumber = require('bignumber.js');

function UInt256Max() {
  return ethers.constants.MaxUint256;
}

function address(n) {
  return `0x${n.toString(16).padStart(40, '0')}`;
}

function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
}

async function etherBalance(addr) {
  return new BigNumber((await ethers.provider.getBalance(addr)).toString());
}

async function mineBlock() {
  return rpc({ method: 'evm_mine' });
}

async function increaseTime(seconds) {
  await rpc({ method: 'evm_increaseTime', params: [seconds] });
  return rpc({ method: 'evm_mine' });
}

async function setTime(seconds) {
  await rpc({ method: 'evm_setTime', params: [new Date(seconds * 1000)] });
}

async function advanceBlocks(blocks) {
  let { result: num } = await rpc({ method: 'eth_blockNumber' });
  await rpc({ method: 'evm_mineBlockNumber', params: [blocks + parseInt(num)] });
}

async function blockNumber() {
  let { result: num } = await rpc({ method: 'eth_blockNumber' });
  return parseInt(num);
}

async function blockTimestamp() {
  let { timestamp } = await ethers.provider.getBlock();
  return timestamp;
}

async function rpc(request) {
  return ethers.provider.send(request.method, request.params);
}

module.exports = {
  address,
  encodeParameters,
  etherBalance,

  advanceBlocks,
  blockNumber,
  blockTimestamp,
  setTime,
  increaseTime,
  mineBlock,
  rpc,

  UInt256Max
};
