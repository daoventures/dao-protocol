const { deployments } = require("hardhat");

async function main() {
  const cfUSDTContract = await deployments.get("CompoundFarmerUSDT");
  const dvlUSDTContract = await deployments.get("DAOVaultLowUSDT");
  const cfUSDCContract = await deployments.get("CompoundFarmerUSDC");
  const dvlUSDCContract = await deployments.get("DAOVaultLowUSDC");
  const cfDAIContract = await deployments.get("CompoundFarmerDAI");
  const dvlDAIContract = await deployments.get("DAOVaultLowDAI");

  console.log("Compound-Farmer USDT address: ", cfUSDTContract.address);
  console.log("DAO Vault Low USDT address: ", dvlUSDTContract.address);
  console.log("");
  console.log("Compound-Farmer USDC address: ", cfUSDCContract.address);
  console.log("DAO Vault Low USDC address: ", dvlUSDCContract.address);
  console.log("");
  console.log("Compound-Farmer DAI address: ", cfDAIContract.address);
  console.log("DAO Vault Low DAI address: ", dvlDAIContract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
