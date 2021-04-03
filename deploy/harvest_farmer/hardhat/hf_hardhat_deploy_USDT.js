const { ethers, network } = require("hardhat");
const { mainnet: network_ } = require("../../../addresses/harvest_farmer");
const IERC20_ABI = require("../../../abis/IERC20_ABI.json");

const { FARMAddress, uniswapRouterAddress, WETHAddress } = network_.GLOBAL;
const { tokenAddress, hfStakeAddress, hfVaultAddress } = network_.USDT;
const created_index = 2; // USDT
const unlockedAddress = "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE";

module.exports = async ({ deployments }) => {
  const [deployer] = await ethers.getSigners();
  let tx, totalGasUsed;

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
  const receipt1 = await tx.wait();
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
  const receipt2 = await tx.wait();
  const vaultAddress = vaultFactoryContract.vaults(created_index);

  // Set vault address into strategy
  const strategyContract = await ethers.getContractAt(
    "HarvestFarmer",
    strategyAddress
  );
  tx = await strategyContract.setVault(vaultAddress);
  const receipt3 = await tx.wait();

  // Transfer token from unlocked account to deployer
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [unlockedAddress],
  });
  const unlockedSigner = await ethers.getSigner(unlockedAddress);
  const tokenContract = new ethers.Contract(
    tokenAddress,
    IERC20_ABI,
    unlockedSigner
  );
  await tokenContract.transfer(
    deployer.address,
    tokenContract.balanceOf(unlockedAddress)
  );

  // // Calculate total gas used for executing functions
  // totalGasUsed = receipt1.gasUsed.add(receipt2.gasUsed).add(receipt3.gasUsed);
  // console.log(
  //   "Total gas used for creating vault and strategy for USDT: " +
  //     totalGasUsed.toString()
  // );
};
module.exports.tags = ["hf_hardhat_deploy_USDT"];
