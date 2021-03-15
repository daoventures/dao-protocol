module.exports = async () => {
  console.log("All contracts had deployed successfully on Mainnet fork.")
};
module.exports.tags = ["hardhat"];
module.exports.dependencies = [
  // "hardhat_reset",
  "hardhat_USDT",
  "hardhat_USDC",
  "hardhat_DAI",
  "hardhat_TUSD",
];
