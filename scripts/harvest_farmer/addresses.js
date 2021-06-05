const { deployments } = require("hardhat");

async function main() {
  const vaultFactoryContract = await ethers.getContract("DAOVaultFactory")
  const strategyFactoryContract = await ethers.getContract("HarvestFarmerFactory")
  const vaultContract = await ethers.getContract("DAOVault")
  const strategyContract = await ethers.getContract("HarvestFarmer")

  const vault_DAI = await vaultFactoryContract.vaults(0)
  const vault_USDC = await vaultFactoryContract.vaults(1)
  const vault_USDT = await vaultFactoryContract.vaults(2)

  console.log("Summary contracts for Harvest Farmer:")
  console.log("DAOVault Medium-Risk DAI address: ", vault_DAI);
  console.log("");
  console.log("DAOVault Medium-Risk USDC address: ", vault_USDC);
  console.log("");
  console.log("DAOVault Medium-Risk USDT address: ", vault_USDT);
  console.log("");
  console.log("*Strategy addresses can be found in DAOVault strategy()");
  console.log("");
  console.log("DAOVault factory address: ", vaultFactoryContract.address)
  console.log("");
  console.log("HarvestFarmer factory address: ", strategyFactoryContract.address)
  console.log("");
  console.log("DAOVault template address: ", vaultContract.address)
  console.log("");
  console.log("HarvestFarmer template address: ", strategyContract.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });