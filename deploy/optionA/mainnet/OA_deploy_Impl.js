const { ethers, network, artifacts, upgrades } = require("hardhat");
const { mainnet: network_ } = require("../../../addresses/optionA");


module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  
  let impl = await deploy("DAOVaultOptionA", {
    from: deployer.address,
  })
  
  let implAddress = await ethers.getContract("DAOVaultOptionA")
  console.log('Implementation address', implAddress.address)

//   console.log("Proxy address", (await DAOVaultOptionA).address);
};

module.exports.tags = ["oa_mainnet_deploy_impl"];