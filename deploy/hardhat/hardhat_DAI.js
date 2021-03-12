const { ethers, network } = require("hardhat");
const { mainnet: network_ } = require("../../addresses");

const tokenAddress = network_.DAI.tokenAddress;
const unlockedAddress = "0x04ad0703B9c14A85A02920964f389973e094E153";

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
module.exports.tags = ["hardhat_DAI"]