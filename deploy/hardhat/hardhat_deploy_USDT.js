const { ethers, network } = require("hardhat");
const { mainnet: network_ } = require("../../addresses");

const tokenAddress = network_.USDT.tokenAddress;
const unlockedAddress = "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8";

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  const cfUSDT = await deploy("CompoundFarmerUSDT", {
    from: deployer.address,
    args: [
      network_.USDT.tokenAddress,
      network_.USDT.cTokenAddress,
      network_.USDT.compTokenAddress,
      network_.USDT.comptrollerAddress,
      network_.USDT.uniswapRouterAddress,
      network_.USDT.WETHAddress,
    ],
  });

  const dvlUSDT = await deploy("DAOVaultLowUSDT", {
    from: deployer.address,
    args: [network_.USDT.tokenAddress, cfUSDT.address],
  });

  const cfUSDTContract = await ethers.getContract("CompoundFarmerUSDT");
  await cfUSDTContract.setVault(dvlUSDT.address);

  // Transfer token from unlocked account to deployer
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
module.exports.tags = ["hardhat_deploy_USDT"]