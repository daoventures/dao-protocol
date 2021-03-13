const { ethers } = require("hardhat");
const { mainnet: network_ } = require("../../addresses");

const tokenAddress = network_.DAI.tokenAddress;

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  console.log("Now deploying YearnFarmerDAIv2...");
  const yfDAIv2 = await deploy("YearnFarmerDAIv2", {
    from: deployer.address,
    args: [
      tokenAddress,
      network_.DAI.yEarnAddress,
      network_.DAI.yVaultAddress,
    ],
  });
  console.log("YearnFarmerDAIv2 contract address: ", yfDAIv2.address);

  console.log("Now deploying YearnFarmerDAIv2...");
  const dvmDAI = await deploy("DAOVaultMediumDAI", {
    from: deployer.address,
    args: [tokenAddress, yfDAIv2.address],
  });
  console.log("DAOVaultMediumDAI contract address: ", dvmDAI.address);

  const yfDAIContract = await ethers.getContract("YearnFarmerDAIv2");
  await yfDAIContract.setVault(dvmDAI.address);
  console.log("Successfully set vault for YearnFarmerDAIv2.");
};
module.exports.tags = ["mainnet_DAI_deploy"];
