const { ethers } = require("hardhat")
const { mainnet } = require("../../../../addresses/index")

const earnStrategyFactoryAddr = "" // from deploy/usd/base/earnStrategyFactory.js
const earnStrategyTemplateAddr = "" // from deploy/btc/base/earnStrategy.js
const curveZapAddr = "" // from deploy/btc/base/curveMetaPoolBTCZap.js

// Curve
const poolAddr = "0x7fC77b5c7614E1533320Ea6DDc2Eb61fa00A9714"
const poolIndex = 7

async function main() {
    let resultVault = "SUCCESS"
    let resultStrategy = "SUCCESS"

    const [deployer] = await ethers.getSigners()
    const earnStrategyFactory = await ethers.getContractAt("EarnStrategyFactory", earnStrategyFactoryAddr, deployer)
    const txResponse = await earnStrategyFactory.createStrategy(
        earnStrategyTemplateAddr,
        poolIndex, curveZapAddr,
        mainnet.admin, mainnet.community, mainnet.strategist,
        { gasLimit: 9000000 }
    )
    try {
        await txResponse.wait()
    } catch(error) {
        if(error.receipt.status == 0) {
            resultStrategy = "FAILED"
        }
    }
    const earnStrategyAddr = await earnStrategyFactory.strategies((await earnStrategyFactory.getTotalStrategies()).sub(1))
    const earnStrategy = await ethers.getContractAt("EarnStrategy", earnStrategyAddr, deployer)
    const EarnVault = await ethers.getContractFactory("EarnVaultBTC", deployer)
    const earnVault = await upgrades.deployProxy(EarnVault, [
        await earnStrategy.lpToken(), earnStrategyAddr, curveZapAddr,
        mainnet.treasury, mainnet.community,
        mainnet.admin, mainnet.strategist, mainnet.biconomy
    ])
    await earnVault.deployed({ gasLimit: 9000000 })
    try {
        await earnVault.deployTransaction.wait()
    } catch(error) {
        if(error.receipt.status == 0) {
            resultVault = "FAILED"
        }
    }
    await earnStrategy.setVault(earnVault.address)
    const curveZap = new ethers.Contract(curveZapAddr, ["function addPool(address, address) external"], deployer)
    await curveZap.addPool( earnVault.address, poolAddr)

    console.log("DAO Earn: sBTC product")
    console.log('EarnVault proxy address:', earnVault.address, resultVault)
    console.log('EarnStrategy address:', earnStrategy.address, resultStrategy)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })