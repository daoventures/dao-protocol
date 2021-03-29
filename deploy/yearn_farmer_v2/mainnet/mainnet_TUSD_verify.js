const { ethers, run } = require("hardhat");
const { mainnet: network_ } = require("../../../addresses/yearn_farmer_v2");

const { tokenAddress, yEarnAddress, yVaultAddress } = network_.TUSD;

module.exports = async () => {
  const yfTUSDContract = await ethers.getContract("YearnFarmerTUSDv2");
  await run("verify:verify", {
    address: yfTUSDContract.address,
    constructorArguments: [tokenAddress, yEarnAddress, yVaultAddress],
    contract: "contracts/strategies/YearnFarmerTUSDv2.sol:YearnFarmerTUSDv2",
  });

  const dvmTUSDContract = await ethers.getContract("DAOVaultMediumTUSD");
  await run("verify:verify", {
    address: dvmTUSDContract.address,
    constructorArguments: [tokenAddress, yfTUSDContract.address],
    contract: "contracts/vaults/DAOVaultMediumTUSD.sol:DAOVaultMediumTUSD",
  });
};
module.exports.tags = ["mainnet_TUSD_verify"];
