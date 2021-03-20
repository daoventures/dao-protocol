const { ethers } = require("hardhat");
const { mainnet: network_ } = require("../../addresses");

const { compTokenAddress, comptrollerAddress, uniswapRouterAddress, WETHAddress } = network_.GLOBAL
const { tokenAddress, cTokenAddress } = network_.DAI

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  const cfDAI = await deploy("CompoundFarmerDAI", {
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

  const dvlDAI = await deploy("DAOVaultLowDAI", {
    from: deployer.address,
    args: [network_.DAI.tokenAddress, cfDAI.address],
  });

  const cfDAIContract = await ethers.getContract("CompoundFarmerDAI");
  await cfDAIContract.setVault(dvlDAI.address);
};
module.exports.tags = ["mainnet_deploy_DAI"]