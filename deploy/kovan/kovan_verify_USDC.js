const { ethers, run } = require("hardhat");
const { kovan: network_ } = require("../../addresses");

const {
  compTokenAddress,
  comptrollerAddress,
  uniswapRouterAddress,
  WETHAddress,
} = network_.GLOBAL;
const { tokenAddress, cTokenAddress } = network_.USDC;

module.exports = async () => {
  const cfUSDCContract = await ethers.getContract("CompoundFarmerUSDC");
  await run("verify:verify", {
    address: cfUSDCContract.address,
    constructorArguments: [
      tokenAddress,
      cTokenAddress,
      compTokenAddress,
      comptrollerAddress,
      uniswapRouterAddress,
      WETHAddress,
    ],
    contract: "contracts/strategies/CompoundFarmerUSDC.sol:CompoundFarmerUSDC",
  });

  const dvlUSDCContract = await ethers.getContract("DAOVaultLowUSDC");
  await run("verify:verify", {
    address: dvlUSDCContract.address,
    constructorArguments: [tokenAddress, cfUSDCContract.address],
    contract: "contracts/vaults/DAOVaultLowUSDC.sol:DAOVaultLowUSDC",
  });
};
module.exports.tags = ["kovan_verify_USDC"];
