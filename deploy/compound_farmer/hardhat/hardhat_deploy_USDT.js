const { ethers, network } = require("hardhat");
const { mainnet: network_ } = require("../../../addresses/compound_farmer");

const { compTokenAddress, comptrollerAddress, uniswapRouterAddress, WETHAddress } = network_.GLOBAL
const { tokenAddress, cTokenAddress } = network_.USDT
const unlockedAddress = "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8";

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  const cfUSDT = await deploy("CompoundFarmerUSDT", {
    from: deployer.address,
    args: [
      tokenAddress,
      cTokenAddress,
      compTokenAddress,
      comptrollerAddress,
      uniswapRouterAddress,
      WETHAddress,
    ],
  });

  const dvlUSDT = await deploy("DAOVaultLowUSDT", {
    from: deployer.address,
    args: [network_.USDT.tokenAddress, cfUSDT.address],
  });

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