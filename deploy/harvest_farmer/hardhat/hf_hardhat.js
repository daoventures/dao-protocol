const { network } = require("hardhat");

module.exports = async ({ deployments }) => {
  const governanceAddress = "0xf00dD244228F51547f0563e60bCa65a30FBF5f7f";
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [governanceAddress],
  });
};
module.exports.tags = ["hf_hardhat"];
module.exports.dependencies = [
  "hf_hardhat_reset",
  "hf_hardhat_deploy_factory",
  "hf_hardhat_deploy_DAI",
  "hf_hardhat_deploy_USDC",
  "hf_hardhat_deploy_USDT",
];
