const { ethers, run } = require("hardhat");
const { mainnet: network_ } = require("../../../addresses/compound_farmer");

const {
  compTokenAddress,
  comptrollerAddress,
  uniswapRouterAddress,
  WETHAddress,
} = network_.GLOBAL;
const { tokenAddress, cTokenAddress } = network_.USDT;

module.exports = async () => {
  const cfUSDTContract = await ethers.getContract("CompoundFarmerUSDT");
  await run("verify:verify", {
    address: cfUSDTContract.address,
    constructorArguments: [
      tokenAddress,
      cTokenAddress,
      compTokenAddress,
      comptrollerAddress,
      uniswapRouterAddress,
      WETHAddress,
    ],
    contract: "contracts/strategies/CompoundFarmerUSDT.sol:CompoundFarmerUSDT",
  });

  const dvlUSDTContract = await ethers.getContract("DAOVaultLowUSDT");
  await run("verify:verify", {
    address: dvlUSDTContract.address,
    constructorArguments: [tokenAddress, cfUSDTContract.address],
    contract: "contracts/vaults/DAOVaultLowUSDT.sol:DAOVaultLowUSDT",
  });
};
module.exports.tags = ["mainnet_verify_USDT"];
