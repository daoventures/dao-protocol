const { ethers, network } = require("hardhat");
const { mainnet: network_ } = require("../../../addresses/yearn_farmer_v2");

const tokenAddress = network_.TUSD.tokenAddress;
const unlockedAddress = "0x270cd0b43f6fE2512A32597C7A05FB01eE6ec8E1";

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  const yfTUSDv2 = await deploy("YearnFarmerTUSDv2", {
    from: deployer.address,
    args: [
      tokenAddress,
      network_.TUSD.yEarnAddress,
      network_.TUSD.yVaultAddress,
    ],
  });
  const dvmTUSD = await deploy("DAOVaultMediumTUSD", {
    from: deployer.address,
    args: [tokenAddress, yfTUSDv2.address],
  });

  // Transfer some token to deployer before each test
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [unlockedAddress],
  });
  const [senderSigner, _] = await ethers.getSigners();
  const unlockedSigner = await ethers.getSigner(unlockedAddress);
  ABI = [
    "function transfer(address, uint) external",
    "function balanceOf(address) external view returns (uint)",
  ];
  const tokenContract = new ethers.Contract(tokenAddress, ABI, senderSigner);
  await tokenContract
    .connect(unlockedSigner)
    .transfer(senderSigner.address, tokenContract.balanceOf(unlockedAddress));
};
module.exports.tags = ["yf_hardhat_TUSD"]
