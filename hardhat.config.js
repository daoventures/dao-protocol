require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();

module.exports = {
  networks: {
    hardhat: {
      forking: {
        url: process.env.ALCHEMY_URL_MAINNET,
        // blockNumber: 12400000, // 322821024047345168023
        // blockNumber: 12460000, // 399023242252551683210
        // blockNumber: 12510000, // 579394340598414536497
        // blockNumber: 12560000, // 466482879584967190166

        // blockNumber: 12618000, // 559420480515219944112
        blockNumber: 12664000, // 645.15516325683238847

        // blockNumber: 12672300,

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
    version: "0.7.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};
