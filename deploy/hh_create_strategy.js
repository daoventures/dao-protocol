const { ethers } = require("hardhat");

const strategyIndex = 4

module.exports = async () => {
    const [deployer, , admin, strategist, , , community] = await ethers.getSigners()
    const earnStrategyPlainPool = await ethers.getContract("EarnStrategyPlainPool", deployer)
    const earnStrategyFactory = await ethers.getContract("EarnStrategyFactory", deployer)
    await earnStrategyFactory.createStrategy(
        strategyIndex,
        earnStrategyPlainPool.address,
        ethers.constants.AddressZero,
        admin.address,
        community.address,
        strategist.address
    )
}
module.exports.tags = ["hh_create_strategy"];
