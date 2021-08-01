const { ethers } = require("hardhat")
const { mainnet } = require("../../../../addresses/index")

const earnStrategyFactoryAddr = "" // from deploy/btc/base/earnStrategyFactory.js
const earnStrategyTemplateAddr = "" // from deploy/btc/base/earnStrategy.js
const curveZapAddr = "" // from deploy/btc/base/curveMetaPoolBTCZap.js

// Curve
const poolAddr = "0x071c661B4DeefB59E2a3DdB20Db036821eeE8F4b"
const zapAddr = "0xC45b2EEe6e09cA176Ca3bB5f7eEe7C47bF93c756"
const poolIndex = 19

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
    const curveZap = new ethers.Contract(curveZapAddr, ["function addPool(address, address, address) external"], deployer)
    await curveZap.addPool( earnVault.address, poolAddr, zapAddr)

    console.log("DAO Earn: BBTC product")
    console.log('EarnVault proxy address:', earnVault.address, resultVault)
    console.log('EarnStrategy address:', earnStrategy.address, resultStrategy)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })