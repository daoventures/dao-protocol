const { ethers } = require("hardhat");

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  // Deploy strategy factory contract
  const Strategy = await deploy("HarvestFarmer", {
    from: deployer.address,
  });
  const StrategyFactory = await deploy("HarvestFarmerFactory", {
    from: deployer.address,
    args: [Strategy.address],
  });

  // Deploy vault factory contract
  const Vault = await deploy("DAOVault", { from: deployer.address });
  const VaultFactory = await deploy("DAOVaultFactory", {
    from: deployer.address,
    args: [Vault.address],
  });
};
module.exports.tags = ["hf_kovan_deploy_factory"];
