const { ethers, run } = require("hardhat");

module.exports = async () => {
  const vaultFactoryContract = await ethers.getContract("DAOVaultFactory");
  const strategyFactoryContract = await ethers.getContract(
    "HarvestFarmerFactory"
  );
  const vaultContract = await ethers.getContract("DAOVault");
  const strategyContract = await ethers.getContract("HarvestFarmer");

  await run("verify:verify", {
    address: vaultFactoryContract.address,
    constructorArguments: [vaultContract.address],
    contract: "contracts/factories/DAOVaultFactory.sol:DAOVaultFactory",
  });

  await run("verify:verify", {
    address: vaultContract.address,
    contract: "contracts/vaults/DAOVault.sol:DAOVault",
  });

  await run("verify:verify", {
    address: strategyFactoryContract.address,
    constructorArguments: [strategyContract.address],
    contract:
      "contracts/factories/HarvestFarmerFactory.sol:HarvestFarmerFactory",
  });

  await run("verify:verify", {
    address: strategyContract.address,
    contract: "contracts/strategies/HarvestFarmer.sol:HarvestFarmer",
  });
};
module.exports.tags = ["hf_mainnet_verify_factory"];
