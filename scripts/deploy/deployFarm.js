const { ethers } = require("hardhat")
const { mainnet } = require("../../addresses/index")

const earnStrategyFactoryAddr = ""
const earnStrategyTemplateAddr = ""
const poolIndex = ""
const curveZapAddr = ""

async function main() {
    const [deployer] = await ethers.getSigners()
    const earnStrategyFactory = await ethers.getContractAt("EarnStrategyFactory", earnStrategyFactoryAddr, deployer)
    await earnStrategyFactory.createStrategy(
        earnStrategyTemplateAddr,
        poolIndex, curveZapAddr,
        mainnet.admin, mainnet.community, mainnet.strategist,
        { gasLimit: 9000000 }
    )
    const earnStrategyAddr = await earnStrategyFactory.strategies((await earnStrategyFactory.getTotalStrategies()).sub(1))
    const earnStrategy = await ethers.getContractAt("EarnStrategy", earnStrategyAddr, deployer)
    const EarnVault = await ethers.getContractFactory("EarnVault", deployer)
    const earnVault = await upgrades.deployProxy(EarnVault, [
        await earnStrategy.lpToken(), earnStrategyAddr, curveZapAddr,
        mainnet.treasury, mainnet.community,
        mainnet.admin, mainnet.strategist, mainnet.biconomy
    ])
    await earnVault.deployed({ gasLimit: 9000000 })
    await earnStrategy.setVault(earnVault.address)
    const curveZap = new ethers.Contract(curveZapAddr, ["function addPool(address, address, address) external"], deployer)
    await curveZap.addPool(earnVault.address, curvePoolAddr, curvePoolZap)

    console.log('EarnVault address:', earnVault.address)
    console.log('EarnStrategy address:', earnStrategy.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })