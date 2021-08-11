const { ethers, network, artifacts, upgrades } = require("hardhat");
const { mainnet: network_ } = require("../../../addresses/optionB");


module.exports = async ({ deployments }) => {
  const { deploy, catchUnknownSigner } = deployments;
  const [deployer] = await ethers.getSigners();

  let impl = await ethers.getContract("DAOVaultOptionB")

  let factory = await deploy("SushiOptionAFactory", {
    from: deployer.address,
    args: [impl.address]
  })

  console.log('Factory deployed to ', factory.address)

};

module.exports.tags = ["oa_mainnet_deploy_factory"];
module.exports.dependencies = ["oa_mainnet_deploy_impl"]