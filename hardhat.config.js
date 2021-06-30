require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();

module.exports = {
  networks: {
    hardhat: {
      forking: {
        url: process.env.ALCHEMY_URL_MAINNET,
        blockNumber: 12672300,

        // url: process.env.ALCHEMY_URL_KOVAN,
        // blockNumber: 25412550, // Kovan
      },
    },
    mainnet: {
      url: process.env.ALCHEMY_URL_MAINNET,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
    kovan: {
      url: process.env.ALCHEMY_URL_KOVAN,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  solidity: {
    version: "0.8.4",
    // version: "0.7.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};