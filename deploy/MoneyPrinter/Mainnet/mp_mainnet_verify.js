const { run, ethers } = require('hardhat')
const {mainnet: addresses}  = require('../../../addresses/moneyPrinter')


const treasuryAddress = addresses.ADDRESSES.treasuryWallet
const adminAddress =addresses.ADDRESSES.adminAddress
const communityWallet = addresses.ADDRESSES.communityWallet
const strategist = addresses.ADDRESSES.strategist
const biconomy = addresses.ADDRESSES.trustedForwarder


module.exports = async() => {
    let vault = await ethers.getContract("MoneyPrinterVault")
    let strategy = await ethers.getContract("MoneyPrinterStrategy")

    const vaultAddress = vault.address
    const strategyAddress = strategy.address

    await run("verify:verify", {
        address: vaultAddress,
        constructorArguments: [ strategyAddress, adminAddress, treasuryAddress, 
            communityWallet, strategist, biconomy ],
        contract: "contracts/moneyPrinter/MoneyPrinterVaultTestnet.sol:MoneyPrinterVaultTestnet"
    })

    await run("verify:verify", {
        address: strategyAddress,
        constructorArguments:[treasuryAddress, communityWallet, strategist],
        contract: "contracts/moneyPrinter/MoneyPrinterVaultTestnet.sol:MoneyPrinterVaultTestnet"
    })
}

module.exports.tags = ["mp_mainnet_verify"]
module.exports.dependencies = ["mp_mainnet"]