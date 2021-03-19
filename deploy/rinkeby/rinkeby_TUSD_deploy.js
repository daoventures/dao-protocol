const { ethers } = require("hardhat");
const { rinkeby: network_ } = require("../../addresses");

const tokenAddress = network_.TUSD.tokenAddress;

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  console.log("Now deploying YearnFarmerTUSDv2...");
  const yfTUSDv2 = await deploy("YearnFarmerTUSDv2", {
    from: deployer.address,
    args: [
      tokenAddress,
      network_.TUSD.yEarnAddress,
      network_.TUSD.yVaultAddress,
    ],
  });
  console.log("YearnFarmerTUSDv2 contract address: ", yfTUSDv2.address);

  console.log("Now deploying DAOVaultMediumTUSD...");
  const dvmTUSD = await deploy("DAOVaultMediumTUSD", {
    from: deployer.address,
    args: [tokenAddress, yfTUSDv2.address],
  });
  console.log("DAOVaultMediumTUSD contract address: ", dvmTUSD.address);

  const yfTUSDContract = await ethers.getContract("YearnFarmerTUSDv2");
  await yfTUSDContract.setVault(dvmTUSD.address);
  console.log("Successfully set vault for YearnFarmerTUSDv2.");
};
module.exports.tags = ["rinkeby_TUSD_deploy"];
