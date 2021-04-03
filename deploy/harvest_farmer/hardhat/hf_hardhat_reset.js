const { network } = require("hardhat");
require("dotenv").config();

module.exports = async () => {
  await network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.ALCHEMY_URL_MAINNET,
          blockNumber: 12121212,
        },
      },
    ],
  });
};
module.exports.tags = ["hf_hardhat_reset"];
