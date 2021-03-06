const { ethers, run } = require("hardhat");
const { mainnet: network_ } = require("../../../addresses/compound_farmer");

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
module.exports.tags = ["mainnet_verify_USDC"];
