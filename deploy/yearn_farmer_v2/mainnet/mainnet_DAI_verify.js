const { ethers, run } = require("hardhat");
const { mainnet: network_ } = require("../../../addresses/yearn_farmer_v2");

const { tokenAddress, yEarnAddress, yVaultAddress } = network_.DAI;

module.exports = async () => {
  const yfDAIContract = await ethers.getContract("YearnFarmerDAIv2");
  await run("verify:verify", {
    address: yfDAIContract.address,
    constructorArguments: [tokenAddress, yEarnAddress, yVaultAddress],
    contract: "contracts/strategies/YearnFarmerDAIv2.sol:YearnFarmerDAIv2",
  });

  const dvmDAIContract = await ethers.getContract("DAOVaultMediumDAI");
  await run("verify:verify", {
    address: dvmDAIContract.address,
    constructorArguments: [tokenAddress, yfDAIContract.address],
    contract: "contracts/vaults/DAOVaultMediumDAI.sol:DAOVaultMediumDAI",
  });
};
module.exports.tags = ["mainnet_DAI_verify"];
