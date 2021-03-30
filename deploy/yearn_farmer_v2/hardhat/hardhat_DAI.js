const { ethers, network } = require("hardhat");
const { mainnet: network_ } = require("../../../addresses/yearn_farmer_v2");

const tokenAddress = network_.DAI.tokenAddress;
const unlockedAddress = "0x01Ec5e7e03e2835bB2d1aE8D2edDEd298780129c";

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

  // Transfer some token to deployer before each test
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [unlockedAddress],
  });
  const [deployerSigner, _] = await ethers.getSigners();
  const unlockedSigner = await ethers.getSigner(unlockedAddress);
  ABI = [
    "function transfer(address, uint) external",
    "function balanceOf(address) external view returns (uint)",
  ];
  const tokenContract = new ethers.Contract(tokenAddress, ABI, deployerSigner);
  await deployerSigner.sendTransaction({to: unlockedAddress, value: ethers.utils.parseEther("1")})
  await tokenContract
    .connect(unlockedSigner)
    .transfer(deployerSigner.address, tokenContract.balanceOf(unlockedAddress));
};
module.exports.tags = ["hardhat_DAI"]