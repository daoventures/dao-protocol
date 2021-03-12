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
module.exports.tags = ["hardhat"]
module.exports.dependencies = ["hardhat_USDT", "hardhat_USDC", "hardhat_DAI", "hardhat_TUSD"]