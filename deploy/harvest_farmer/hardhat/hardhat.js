const axios = require("axios");
const { ethers, network } = require("hardhat");
const { mainnet: network_ } = require("../../addresses");
require("dotenv").config();

const {
  compTokenAddress,
  comptrollerAddress,
  uniswapRouterAddress,
  WETHAddress,
} = network_.GLOBAL;
const { tokenAddress: DAIAddress, cTokenAddress: cDAIAddress } = network_.DAI;
const { tokenAddress: USDCAddress, cTokenAddress: cUSDCAddress } = network_.USDC;
const { tokenAddress: USDTAddress, cTokenAddress: cUSDTAddress } = network_.USDT;
const unlockedAddress = "0x04ad0703B9c14A85A02920964f389973e094E153";

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  const DAOStrategy = await deploy("DAOStrategy", { from: deployer.address });
  const DAOStrategyFactory = await deploy("DAOStrategyFactory", {
    from: deployer.address,
    args: [DAOStrategy.address],
  });
  const daoStrategyFactoryContract = await ethers.getContractAt(
    "DAOStrategyFactory",
    DAOStrategyFactory.address
  );
  let tx
  tx = await daoStrategyFactoryContract.createStrategy(
    ethers.utils.formatBytes32String("Compound-Farmer DAI"),
    DAIAddress,
    cDAIAddress,
    compTokenAddress,
    comptrollerAddress,
    uniswapRouterAddress,
    WETHAddress
  );
  const receiptDAI = await tx.wait()
  const cfDAIAddress = (await daoStrategyFactoryContract.getDAOStrategies())[0];
  tx = await daoStrategyFactoryContract.createStrategy(
    ethers.utils.formatBytes32String("Compound-Farmer USDC"),
    USDCAddress,
    cUSDCAddress,
    compTokenAddress,
    comptrollerAddress,
    uniswapRouterAddress,
    WETHAddress
  );
  const receiptUSDC = await tx.wait()
  const cfUSDCAddress = (await daoStrategyFactoryContract.getDAOStrategies())[1];
  tx = await daoStrategyFactoryContract.createStrategy(
    ethers.utils.formatBytes32String("Compound-Farmer USDT"),
    USDTAddress,
    cUSDTAddress,
    compTokenAddress,
    comptrollerAddress,
    uniswapRouterAddress,
    WETHAddress
  );
  const receiptUSDT = await tx.wait()
  const cfUSDTAddress = (await daoStrategyFactoryContract.getDAOStrategies())[2];

  const DAOVault = await deploy("DAOVault", { from: deployer.address });
  const DAOVaultFactory = await deploy("DAOVaultFactory", {
    from: deployer.address,
    args: [DAOVault.address],
  });
  const daoVaultFactoryContract = await ethers.getContractAt(
    "DAOVaultFactory",
    DAOVaultFactory.address
  );
  tx = await daoVaultFactoryContract.createVault(ethers.utils.formatBytes32String("DAOVault Low-Risk DAI"), DAIAddress, cfDAIAddress);
  const receiptDAI2 = await tx.wait()
  const dvlDAIAddress = (await daoVaultFactoryContract.getDAOVaults())[0];
  tx = await daoVaultFactoryContract.createVault(ethers.utils.formatBytes32String("DAOVault Low-Risk USDC"), USDCAddress, cfUSDCAddress);
  const receiptUSDC2 = await tx.wait()
  const dvlUSDCAddress = (await daoVaultFactoryContract.getDAOVaults())[1];
  tx = await daoVaultFactoryContract.createVault(ethers.utils.formatBytes32String("DAOVault Low-Risk USDT"), USDTAddress, cfUSDTAddress);
  const receiptUSDT2 = await tx.wait()
  const dvlUSDTAddress = (await daoVaultFactoryContract.getDAOVaults())[2];

  const cfDAIContract = await ethers.getContractAt("DAOStrategy", cfDAIAddress);
  tx = await cfDAIContract.setVault(dvlDAIAddress);
  const receiptDAI3 = await tx.wait()
  const cfUSDCContract = await ethers.getContractAt("DAOStrategy", cfUSDCAddress);
  tx = await cfUSDCContract.setVault(dvlUSDCAddress);
  const receiptUSDC3 = await tx.wait()
  const cfUSDTContract = await ethers.getContractAt("DAOStrategy", cfUSDTAddress);
  tx = await cfUSDTContract.setVault(dvlUSDTAddress);
  const receiptUSDT3 = await tx.wait()

  // Transfer token from unlocked account to deployer
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [unlockedAddress],
  });
  const [senderSigner, _] = await ethers.getSigners();
  const unlockedSigner = await ethers.getSigner(unlockedAddress);
  ABI = [
    "function transfer(address, uint) external",
    "function balanceOf(address) external view returns (uint)",
  ];
  const tokenContract = new ethers.Contract(DAIAddress, ABI, senderSigner);
  await tokenContract
    .connect(unlockedSigner)
    .transfer(senderSigner.address, tokenContract.balanceOf(unlockedAddress));

  let totalGasUsed
  totalGasUsed = 
  parseInt(DAOStrategy.receipt.gasUsed) +
  parseInt(DAOStrategyFactory.receipt.gasUsed) +
  parseInt(DAOVault.receipt.gasUsed) +
  parseInt(DAOVaultFactory.receipt.gasUsed)

  totalGasUsed = ethers.BigNumber.from(totalGasUsed)
  totalGasUsed = totalGasUsed.add
  (receiptDAI.gasUsed).add(receiptDAI2.gasUsed).add(receiptDAI3.gasUsed).add
  (receiptUSDC.gasUsed).add(receiptUSDC2.gasUsed).add(receiptUSDC3.gasUsed).add
  (receiptUSDT.gasUsed).add(receiptUSDT2.gasUsed).add(receiptUSDT3.gasUsed)
  console.log(totalGasUsed.toString())
};
module.exports.tags = ["hardhat"];
