const { ethers } = require("hardhat");
const { mainnet: network_ } = require("../../../addresses/yearn_farmer_v2");

const tokenAddress = network_.USDT.tokenAddress;

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  console.log("Now deploying YearnFarmerUSDTv2...");
  const yfUSDTv2 = await deploy("YearnFarmerUSDTv2", {
    from: deployer.address,
    args: [
      tokenAddress,
      network_.USDT.yEarnAddress,
      network_.USDT.yVaultAddress,
    ],
  });
  console.log("YearnFarmerUSDTv2 contract address: ", yfUSDTv2.address);

  console.log("Now deploying YearnFarmerUSDTv2...");
  const dvmUSDT = await deploy("DAOVaultMediumUSDT", {
    from: deployer.address,
    args: [tokenAddress, yfUSDTv2.address],
  });
  console.log("DAOVaultMediumUSDT contract address: ", dvmUSDT.address);

  const yfUSDTContract = await ethers.getContract("YearnFarmerUSDTv2");
  await yfUSDTContract.setVault(dvmUSDT.address);
  console.log("Successfully set vault for YearnFarmerUSDTv2.");
};
module.exports.tags = ["mainnet_USDT_deploy"];
