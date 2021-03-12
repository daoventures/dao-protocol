const { ethers, network } = require("hardhat");
const { mainnet: network_ } = require("../../addresses");

const tokenAddress = network_.USDC.tokenAddress;
const unlockedAddress = "0x55FE002aefF02F77364de339a1292923A15844B8";

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  const yfUSDCv2 = await deploy("YearnFarmerUSDCv2", {
    from: deployer.address,
    args: [
      tokenAddress,
      network_.USDC.yEarnAddress,
      network_.USDC.yVaultAddress,
    ],
  });
  const dvmUSDC = await deploy("DAOVaultMediumUSDC", {
    from: deployer.address,
    args: [tokenAddress, yfUSDCv2.address],
  });

  const yfUSDCContract = await ethers.getContract("YearnFarmerUSDCv2");
  await yfUSDCContract.setVault(dvmUSDC.address);

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
module.exports.tags = ["hardhat_USDC"]
