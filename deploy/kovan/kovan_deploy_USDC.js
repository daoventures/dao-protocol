const { ethers } = require("hardhat");
const { kovan: network_ } = require("../../addresses");

const { compTokenAddress, comptrollerAddress, uniswapRouterAddress, WETHAddress } = network_.GLOBAL
const { tokenAddress, cTokenAddress } = network_.USDC

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  const cfUSDC = await deploy("CompoundFarmerUSDC", {
    from: deployer.address,
    args: [
      tokenAddress,
      cTokenAddress,
      compTokenAddress,
      comptrollerAddress,
      uniswapRouterAddress,
      WETHAddress,
    ],
  });

  const dvlUSDC = await deploy("DAOVaultLowUSDC", {
    from: deployer.address,
    args: [network_.USDC.tokenAddress, cfUSDC.address],
  });

  const cfUSDCContract = await ethers.getContract("CompoundFarmerUSDC");
  await cfUSDCContract.setVault(dvlUSDC.address);
};
module.exports.tags = ["kovan_deploy_USDC"]