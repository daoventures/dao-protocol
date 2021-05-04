const { ethers } = require("hardhat");
const { rinkeby: network_ } = require("../../../addresses/harvest_farmer");

const { FARMAddress, uniswapRouterAddress, WETHAddress } = network_.GLOBAL;
const { tokenAddress, hfStakeAddress, hfVaultAddress } = network_.USDT;
const created_index = 2; // USDT

module.exports = async () => {
  let tx
  // Create strategy
  const strategyFactoryContract = await ethers.getContract(
    "HarvestFarmerFactory"
  );
  tx = await strategyFactoryContract.createStrategy(
    ethers.utils.formatBytes32String("Harvest-Farmer USDT"),
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
    ethers.utils.formatBytes32String("DAOVault Medium-Risk USDT"),
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
module.exports.tags = ["hf_rinkeby_deploy_USDT"];