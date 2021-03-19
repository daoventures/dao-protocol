const { ethers } = require("hardhat");
const { rinkeby: network_ } = require("../../addresses");

const tokenAddress = network_.DAI.tokenAddress;

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  const yfDAIv2 = await deploy("YearnFarmerDAIv2", {
    from: deployer.address,
    args: [
      tokenAddress,
      network_.DAI.yEarnAddress,
      network_.DAI.yVaultAddress,
    ],
  });
  const dvmDAI = await deploy("DAOVaultMediumDAI", {
    from: deployer.address,
    args: [tokenAddress, yfDAIv2.address],
  });

  const yfDAIContract = await ethers.getContract("YearnFarmerDAIv2");
  await yfDAIContract.setVault(dvmDAI.address);

  console.log("YearnFarmerDAIv2 contract address: ", yfDAIv2.address);
  console.log("DAOVaultMediumDAI contract address: ", dvmDAI.address);
};
module.exports.tags = ["rinkeby_DAI_deploy"];
