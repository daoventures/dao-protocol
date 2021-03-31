const { ethers } = require("hardhat");
const { kovan: network_ } = require("../../../addresses/compound_farmer");

const { compTokenAddress, comptrollerAddress, uniswapRouterAddress, WETHAddress } = network_.GLOBAL
const { tokenAddress, cTokenAddress } = network_.USDT

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  const cfUSDT = await deploy("CompoundFarmerUSDT", {
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

  const dvlUSDT = await deploy("DAOVaultLowUSDT", {
    from: deployer.address,
    args: [network_.USDT.tokenAddress, cfUSDT.address],
  });

  const cfUSDTContract = await ethers.getContract("CompoundFarmerUSDT");
  await cfUSDTContract.setVault(dvlUSDT.address);
};
module.exports.tags = ["kovan_deploy_USDT"]