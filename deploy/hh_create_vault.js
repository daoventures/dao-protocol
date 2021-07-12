const { ethers } = require("hardhat");

const index = 0
const earnStrategyName = "EarnStrategyPlainPool"
// const earnStrategyName = "EarnStrategyMetaPool"
// const earnStrategyName = "EarnStrategyLendingPool"

module.exports = async () => {
    const [deployer, , admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
    const earnStrategyFactory = await ethers.getContract("EarnStrategyFactory", deployer)
    const earnStrategyAddr = await earnStrategyFactory.strategies(index)
    const earnVaultFactory = await ethers.getContract("EarnVaultFactory", deployer)
    await earnVaultFactory.createVault(
        earnStrategyAddr,
        treasury.address, community.address,
        admin.address, strategist.address, biconomy.address
    )
    const earnVaultAddr = await earnVaultFactory.vaults(index)
    const earnStrategy = await ethers.getContractAt(
        earnStrategyName,
        earnStrategyAddr
    )
    await earnStrategy.setVault(earnVaultAddr)
}
module.exports.tags = ["hh_create_strategy"];
