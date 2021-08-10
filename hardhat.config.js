require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("@nomiclabs/hardhat-solhint");
require("hardhat-contract-sizer")
require("dotenv").config();

module.exports = {
  networks: {
    hardhat: {
      forking: {
        url: process.env.ALCHEMY_URL_MAINNET,
        gas: 12000000,
        // accounts: [`0x${process.env.PRIVATE_KEY}`],
        blockNumber: 12997854 //12990311,
        // blockGasLimit: 0x1fffffffffffff,
        // allowUnlimitedContractSize: true
      },
      // gas: 12000000,
      // blockGasLimit: 0x1C9C380,
      // allowUnlimitedContractSize: true
    },
    // mainnet: {
    //   url: process.env.ALCHEMY_URL_MAINNET,
    //   accounts: [`0x${process.env.PRIVATE_KEY}`],
    // },
    // kovan: {
    //   url: process.env.ALCHEMY_URL_KOVAN,
    //   accounts: [`0x${process.env.PRIVATE_KEY}`],
    // },
    // rinkeby: {
    //   url: process.env.ALCHEMY_URL_RINKEBY,
    //   accounts: [`0x${process.env.PRIVATE_KEY}`],
    // },
    goerli: {
      url: process.env.ALCHEMY_URL_MAINNET,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
  },
  // etherscan: {
  //   apiKey: process.env.ETHERSCAN_API_KEY,
  // },
  solidity: {
    version: "0.7.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 500,
      },
    },
  },
  mocha: {
    timeout: 7000000
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  }
};
