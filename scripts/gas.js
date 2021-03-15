const { deployments } = require("hardhat");

async function main() {
  const yfUSDTContract = await deployments.get("YearnFarmerUSDTv2");
  const dvmUSDTContract = await deployments.get("DAOVaultMediumUSDT");
  const yfUSDCContract = await deployments.get("YearnFarmerUSDCv2");
  const dvmUSDCContract = await deployments.get("DAOVaultMediumUSDC");
  const yfDAIContract = await deployments.get("YearnFarmerDAIv2");
  const dvmDAIContract = await deployments.get("DAOVaultMediumDAI");
  const yfTUSDContract = await deployments.get("YearnFarmerTUSDv2");
  const dvmTUSDContract = await deployments.get("DAOVaultMediumTUSD");

  const totalGasUsed = yfDAIContract.receipt.gasUsed +
    yfTUSDContract.receipt.gasUsed +
    yfUSDCContract.receipt.gasUsed +
    yfUSDTContract.receipt.gasUsed +
    dvmDAIContract.receipt.gasUsed +
    dvmTUSDContract.receipt.gasUsed +
    dvmUSDCContract.receipt.gasUsed +
    dvmUSDTContract.receipt.gasUsed
  console.log(totalGasUsed)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
