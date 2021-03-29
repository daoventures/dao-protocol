const { ethers, run } = require("hardhat");
const { kovan: network_ } = require("../../../addresses/compound_farmer");

const {
  compTokenAddress,
  comptrollerAddress,
  uniswapRouterAddress,
  WETHAddress,
} = network_.GLOBAL;
const { tokenAddress, cTokenAddress } = network_.DAI;

module.exports = async () => {
  const cfDAIContract = await ethers.getContract("CompoundFarmerDAI");
  await run("verify:verify", {
    address: cfDAIContract.address,
    constructorArguments: [
      tokenAddress,
      cTokenAddress,
      compTokenAddress,
      comptrollerAddress,
      uniswapRouterAddress,
      WETHAddress,
    ],
    contract: "contracts/strategies/CompoundFarmerDAI.sol:CompoundFarmerDAI",
  });

  const dvlDAIContract = await ethers.getContract("DAOVaultLowDAI");
  await run("verify:verify", {
    address: dvlDAIContract.address,
    constructorArguments: [tokenAddress, cfDAIContract.address],
    contract: "contracts/vaults/DAOVaultLowDAI.sol:DAOVaultLowDAI",
  });
};
module.exports.tags = ["kovan_verify_DAI"];
