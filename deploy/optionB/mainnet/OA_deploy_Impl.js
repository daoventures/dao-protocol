const { ethers, network, artifacts, upgrades } = require("hardhat");
const { mainnet: network_ } = require("../../../addresses/optionB");


module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  console.log(deployer.address)
  let impl = await deploy("DAOVaultOptionB", {
    from: deployer.address,
  })
  console.log('after')
  let implAddress = await ethers.getContract("DAOVaultOptionB")
  console.log('Implementation address', implAddress.address)

};

module.exports.tags = ["oa_mainnet_deploy_impl"];