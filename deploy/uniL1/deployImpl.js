const { ethers, network, artifacts, upgrades } = require("hardhat");
const { mainnet: network_ } = require("../../addresses/uniL1");


module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  
  let impl = await deploy("uniVault", {
    from: deployer.address,
  })
  
  let implAddress = await ethers.getContract("uniVault")
  console.log('Implementation address', implAddress.address)

//   console.log("Proxy address", (await DAOVaultOptionA).address);
};

module.exports.tags = ["uni_mainnet_deploy_impl"];