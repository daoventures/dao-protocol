const { ethers } = require("hardhat");
const { kovan: network_ } = require("../../../addresses/harvest_farmer");

const { FARMAddress, uniswapRouterAddress, WETHAddress } = network_.GLOBAL;
const { tokenAddress, hfStakeAddress, hfVaultAddress } = network_.USDC;
const created_index = 1; // USDC

module.exports = async () => {
  let tx
  // Create strategy
  const strategyFactoryContract = await ethers.getContract(
    "HarvestFarmerFactory"
  );
  tx = await strategyFactoryContract.createStrategy(
    ethers.utils.formatBytes32String("Harvest-Farmer USDC"),
    tokenAddress,
    hfVaultAddress,
    hfStakeAddress,
    FARMAddress,
    uniswapRouterAddress,
    WETHAddress
  );
  await tx.wait()
  const strategyAddress = await strategyFactoryContract.strategies(
    created_index
  );

  // Create vault
  const vaultFactoryContract = await ethers.getContract("DAOVaultFactory");
  tx = await vaultFactoryContract.createVault(
    ethers.utils.formatBytes32String("DAOVault Medium-Risk USDC"),
    tokenAddress,
    strategyAddress
  );
  await tx.wait()
  const vaultAddress = await vaultFactoryContract.vaults(created_index);

  // Set vault address into strategy
  const strategyContract = await ethers.getContractAt(
    "HarvestFarmer",
    strategyAddress
  );
  await strategyContract.setVault(vaultAddress);
};
module.exports.tags = ["hf_kovan_deploy_USDC"];
