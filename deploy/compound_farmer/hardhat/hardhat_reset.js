const { network } = require("hardhat");

module.exports = async () => {
  await network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.ALCHEMY_URL_MAINNET,
          blockNumber: 11960000,
        },
      },
    ],
  });
};
module.exports.tags = ["hardhat_reset"]