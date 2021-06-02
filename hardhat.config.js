require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("hardhat-gas-reporter");
require("@nomiclabs/hardhat-solhint");
require("dotenv").config();

module.exports = {
  networks: {
    hardhat: {
      forking: {
        url: process.env.ALCHEMY_URL_MAINNET,
        // blockNumber: 11960000,
      },
    },
    // mainnet: {
    //   url: process.env.ALCHEMY_URL_MAINNET,
    //   accounts: [`0x${process.env.PRIVATE_KEY}`],
    // },
    kovan: {
      url: process.env.ALCHEMY_URL_KOVAN,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
    // rinkeby: {
    //   url: process.env.ALCHEMY_URL_RINKEBY,
    //   accounts: [`0x${process.env.PRIVATE_KEY}`],
    // },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  solidity: {
    version: "0.7.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  gasReporter: {
    enabled: (process.env.REPORT_GAS) ? true : false
  },
};
