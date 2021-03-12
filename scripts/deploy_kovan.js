const { ethers, run } = require("hardhat");
const { kovan } = require("../addresses");

async function main() {
  console.log("Network: Kovan");
  // USDT
  const CfUSDTContract = await ethers.getContractFactory("CompoundFarmerUSDT");
  const cfUSDTContract = await CfUSDTContract.deploy(
    kovan.USDTAddress,
    kovan.cTokenAddress,
    kovan.compTokenAddress,
    kovan.comptrollerAddress,
    kovan.uniswapRouterAddress,
    kovan.WETHAddress
  );
  console.log("CompoundFarmerUSDT contract address: ", cfUSDTContract.address);
  const DvlUSDTContract = await ethers.getContractFactory("DAOVaultLowUSDT");
  const dvlUSDTContract = await DvlUSDTContract.deploy(kovan.USDTAddress, cfUSDTContract.address);
  await cfUSDTContract.setVault(dvlUSDTContract.address);
  console.log("DAOVaultLowUSDT contract address: ", dvlUSDTContract.address);

  await run("verify:verify", {
    address: cfUSDTContract.address,
    constructorArguments: [
      kovan.USDTAddress,
      kovan.cTokenAddress,
      kovan.compTokenAddress,
      kovan.comptrollerAddress,
      kovan.uniswapRouterAddress,
      kovan.WETHAddress,
    ],
  });

  await hre.run("verify:verify", {
    address: dvlUSDTContract.address,
    constructorArguments: [kovan.USDTAddress, cfUSDTContract.address],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
