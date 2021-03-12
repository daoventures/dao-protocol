const { ethers, network } = require("hardhat");
const { mainnet: network_ } = require("../../addresses");

const tokenAddress = network_.USDT.tokenAddress;
const unlockedAddress = "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8";

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  const yfUSDTv2 = await deploy("YearnFarmerUSDTv2", {
    from: deployer.address,
    args: [
      tokenAddress,
      network_.USDT.yEarnAddress,
      network_.USDT.yVaultAddress,
    ],
  });
  const dvmUSDT = await deploy("DAOVaultMediumUSDT", {
    from: deployer.address,
    args: [tokenAddress, yfUSDTv2.address],
  });

  const yfUSDTContract = await ethers.getContract("YearnFarmerUSDTv2");
  await yfUSDTContract.setVault(dvmUSDT.address);

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
module.exports.tags = ["hardhat_USDT"]
