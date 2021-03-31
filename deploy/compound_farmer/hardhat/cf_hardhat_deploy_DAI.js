const { ethers, network } = require("hardhat");
const { mainnet: network_ } = require("../../../addresses/compound_farmer");

const { compTokenAddress, comptrollerAddress, uniswapRouterAddress, WETHAddress } = network_.GLOBAL
const { tokenAddress, cTokenAddress } = network_.DAI
const unlockedAddress = "0x04ad0703B9c14A85A02920964f389973e094E153";

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  const cfDAI = await deploy("CompoundFarmerDAI", {
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

  const dvlDAI = await deploy("DAOVaultLowDAI", {
    from: deployer.address,
    args: [network_.DAI.tokenAddress, cfDAI.address],
  });

  // Transfer token from unlocked account to deployer
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [unlockedAddress],
  });
  const [senderSigner, _] = await ethers.getSigners();
  await senderSigner.sendTransaction({to: unlockedAddress, value: ethers.utils.parseUnits("1")})
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
module.exports.tags = ["cf_hardhat_deploy_DAI"]