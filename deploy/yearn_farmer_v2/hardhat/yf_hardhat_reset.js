const { network } = require("hardhat");

module.exports = async () => {
  await network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.ALCHEMY_URL_MAINNET,
          blockNumber: 12020000,
        },
      },
    ],
  });
};
module.exports.tags = ["yf_hardhat_reset"]