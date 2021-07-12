const { ethers } = require("hardhat");

module.exports = async ({ deployments }) => {
    const { deploy } = deployments
    const [deployer] = await ethers.getSigners()
    await deploy(
        "EarnStrategyPlainPool",
        {from: deployer.address}
    )
}
module.exports.tags = ["hh_deploy_plainPoolTemplate"];
