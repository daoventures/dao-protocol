const { ethers } = require("hardhat");

module.exports = async ({ deployments }) => {
    const { deploy } = deployments
    const [deployer] = await ethers.getSigners()
    // Deploy strategy factory contract
    const earnStrategyFactory = await deploy(
        "EarnStrategyFactory",
        {from: deployer.address}
    )
    // Deploy vault template contract
    const earnVaultTemplate = await deploy(
        "EarnVault",
        {from: deployer.address}
    )
    // Deploy vault factory contract
    await deploy("EarnVaultFactory",
        {
            from: deployer.address,
            args: [earnVaultTemplate.address],
        }
    )
}
module.exports.tags = ["hh_deploy_factories"];
