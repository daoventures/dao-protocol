const { ethers } = require("hardhat");
const { rinkeby: network_ } = require("../../addresses");

const tokenAddress = network_.USDC.tokenAddress;

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  console.log("Now deploying YearnFarmerUSDCv2...");
  const yfUSDCv2 = await deploy("YearnFarmerUSDCv2", {
    from: deployer.address,
    args: [
      tokenAddress,
      network_.USDC.yEarnAddress,
      network_.USDC.yVaultAddress,
    ],
  });
  console.log("YearnFarmerUSDCv2 contract address: ", yfUSDCv2.address);

  console.log("Now deploying YearnFarmerUSDCv2...");
  const dvmUSDC = await deploy("DAOVaultMediumUSDC", {
    from: deployer.address,
    args: [tokenAddress, yfUSDCv2.address],
  });
  console.log("DAOVaultMediumUSDC contract address: ", dvmUSDC.address);

  const yfUSDCContract = await ethers.getContract("YearnFarmerUSDCv2");
  await yfUSDCContract.setVault(dvmUSDC.address);
  console.log("Successfully set vault for YearnFarmerUSDCv2.");
};
module.exports.tags = ["rinkeby_USDC_deploy"];
