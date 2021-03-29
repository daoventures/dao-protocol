const { deployments } = require("hardhat");

module.exports = async () => {
  const yfUSDTContract = await deployments.get("YearnFarmerUSDTv2");
  const dvmUSDTContract = await deployments.get("DAOVaultMediumUSDT");
  const yfUSDCContract = await deployments.get("YearnFarmerUSDCv2");
  const dvmUSDCContract = await deployments.get("DAOVaultMediumUSDC");
  const yfDAIContract = await deployments.get("YearnFarmerDAIv2");
  const dvmDAIContract = await deployments.get("DAOVaultMediumDAI");
  const yfTUSDContract = await deployments.get("YearnFarmerTUSDv2");
  const dvmTUSDContract = await deployments.get("DAOVaultMediumTUSD");

  console.log("Summary:");
  console.log("Yearn-Farmer USDT v2 address: ", yfUSDTContract.address);
  console.log("DAO Vault Medium USDT address: ", dvmUSDTContract.address);
  console.log("");
  console.log("Yearn-Farmer USDC v2 address: ", yfUSDCContract.address);
  console.log("DAO Vault Medium USDC address: ", dvmUSDCContract.address);
  console.log("");
  console.log("Yearn-Farmer DAI v2 address: ", yfDAIContract.address);
  console.log("DAO Vault Medium DAI address: ", dvmDAIContract.address);
  console.log("");
  console.log("Yearn-Farmer TUSD v2 address: ", yfTUSDContract.address);
  console.log("DAO Vault Medium TUSD address: ", dvmTUSDContract.address);
};
module.exports.tags = ["rinkeby"];
module.exports.dependencies = [
  "rinkeby_USDT_deploy",
  "rinkeby_USDC_deploy",
  "rinkeby_DAI_deploy",
  "rinkeby_TUSD_deploy",
  "rinkeby_USDT_verify",
  "rinkeby_USDC_verify",
  "rinkeby_DAI_verify",
  "rinkeby_TUSD_verify",
];
