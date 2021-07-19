require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("@nomiclabs/hardhat-solhint");
require("dotenv").config();

module.exports = {
  networks: {
    hardhat: {
      forking: {
        url: process.env.ALCHEMY_URL_MAINNET,//process.env.POLYGON_MUMBAI_URL,
        blockNumber: 16154548,
      },
    },

    mumbai: {
      url: process.env.POLYGON_MUMBAI_URL,
      accounts: [process.env.DEPLOYER_KEY],
      // gas: 4183321
    },
    mainnet: {
      url: process.env.ALCHEMY_URL_MAINNET,
      accounts: [process.env.DEPLOYER_KEY]
    }

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
  mocha: {
    timeout: 7000000
  }
};
