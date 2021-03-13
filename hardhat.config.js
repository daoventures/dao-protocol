require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("dotenv").config();

task("check", "Check addresses for all deployed contracts", async () => {
  const yfUSDTContract = await deployments.get("YearnFarmerUSDTv2");
  const dvmUSDTContract = await deployments.get("DAOVaultMediumUSDT");
  const yfUSDCContract = await deployments.get("YearnFarmerUSDCv2");
  const dvmUSDCContract = await deployments.get("DAOVaultMediumUSDC");
  const yfDAIContract = await deployments.get("YearnFarmerDAIv2");
  const dvmDAIContract = await deployments.get("DAOVaultMediumDAI");
  const yfTUSDContract = await deployments.get("YearnFarmerTUSDv2");
  const dvmTUSDContract = await deployments.get("DAOVaultMediumTUSD");

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
})

module.exports = {
  networks: {
    hardhat: {
      forking: {
        url: process.env.ALCHEMY_URL_MAINNET,
        blockNumber: 11960000,
      },
    },
    mainnet: {
      url: process.env.ALCHEMY_URL_MAINNET,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
    // rinkeby: {
    //   url: process.env.ALCHEMY_URL_RINKEBY,
    //   accounts: [`0x${process.env.PRIVATE_KEY}`],
    // },
  },
  // etherscan: {
  //   apiKey: process.env.ETHERSCAN_API_KEY,
  // },
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      },
    ],
  },
};
