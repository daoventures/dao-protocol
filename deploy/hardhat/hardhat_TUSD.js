const { ethers, network } = require("hardhat");
const { mainnet: network_ } = require("../../addresses");

const tokenAddress = network_.TUSD.tokenAddress;
const unlockedAddress = "0x701bd63938518d7DB7e0f00945110c80c67df532";

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

  const yfTUSDContract = await ethers.getContract("YearnFarmerTUSDv2");
  await yfTUSDContract.setVault(dvmTUSD.address);

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
module.exports.tags = ["hardhat_TUSD"]
