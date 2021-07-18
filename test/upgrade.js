const { ethers, upgrades } = require("hardhat")
const { expect } = require("chai")

const lpTokenAddr = "0x43b4FdFD4Ff969587185cDB6f0BD875c5Fc83f8c"
const curvePoolAddr = "0x43b4FdFD4Ff969587185cDB6f0BD875c5Fc83f8c"
const curvePoolZap = "0xA79828DF1850E8a3A3064576f380D90aECDD3359"
const poolIndex = 36
const curveZapType = "CurveMetaPoolZap"

describe("DAO Earn", () => {
    it("should upgrade new vault successfully", async () => {
        const [deployer, owner, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
        const CurveZap = await ethers.getContractFactory(curveZapType, deployer)
        const curveZap = await CurveZap.deploy()
        const EarnStrategyTemplate = await ethers.getContractFactory("EarnStrategy", deployer)
        const earnStrategyTemplate = await EarnStrategyTemplate.deploy()
        const EarnStrategyFactory = await ethers.getContractFactory("EarnStrategyFactory", deployer)
        const earnStrategyFactory = await EarnStrategyFactory.deploy()
        await earnStrategyFactory.createStrategy(
            earnStrategyTemplate.address,
            poolIndex, curveZap.address,
            admin.address, community.address, strategist.address
        )
        const earnStrategyAddr = await earnStrategyFactory.strategies((await earnStrategyFactory.getTotalStrategies()).sub(1))
        const earnStrategy = await ethers.getContractAt("EarnStrategy", earnStrategyAddr, deployer)
        const EarnVault = await ethers.getContractFactory("EarnVault", deployer)
        const earnVault = await upgrades.deployProxy(EarnVault, [
            await earnStrategy.lpToken(), earnStrategyAddr, curveZap.address,
            treasury.address, community.address,
            admin.address, strategist.address, biconomy.address
        ])
        await earnVault.deployed()
        await earnStrategy.setVault(earnVault.address)
        await curveZap.addPool(earnVault.address, curvePoolAddr, curvePoolZap)

        // Transfer ownership to owner
        await earnVault.transferOwnership(owner.address)
        await earnStrategy.transferOwnership(owner.address)
        await curveZap.transferOwnership(owner.address)
        await upgrades.admin.transferProxyAdminOwnership(owner.address)

        // const EarnVault2 = await ethers.getContractFactory("EarnVault", deployer)
        // const earnVault2Addr = await upgrades.prepareUpgrade(earnVault.address, EarnVault2)

        const EarnVault2 = await ethers.getContractFactory("EarnVault", owner) // Signer must be owner after proxy transfer ownership to owner
        const earnVault2 = await upgrades.upgradeProxy(earnVault.address, EarnVault2)
        expect(await earnVault.strategy()).to.equal(await earnVault2.strategy())
    })
})