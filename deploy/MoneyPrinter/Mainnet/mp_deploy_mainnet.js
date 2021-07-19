const {ethers} = require('hardhat')
const {mainnet: addresses} = require("../../../addresses/moneyPrinter")

module.exports = async ({deployments}) => {
    const {deploy} = deployments
    const [deployer] = await ethers.getSigners()

    const strategy = await deploy("MoneyPrinterStrategy",{
        from: deployer.address,
        args:[addresses.ADDRESSES.treasuryWallet, addresses.ADDRESSES.communityWallet,
            addresses.ADDRESSES.strategist]
    })

    const vault = await deploy("MoneyPrinterVault", {
        from: deployer.address,
        args: [strategy.address, addresses.ADDRESSES.adminAddress, 
            addresses.ADDRESSES.treasuryWallet, addresses.ADDRESSES.communityWallet, 
            addresses.ADDRESSES.strategist, addresses.ADDRESSES.trustedForwarder]
    })

    const MoneyPrinerStrategy = await ethers.getContract("MoneyPrinterStrategy")

    await MoneyPrinerStrategy.connect(deployer).setVault(vault.address)

    console.log("Vault: ", vault.address)
    console.log("Strategy: ", strategy.address)
}

module.exports.tags = ["mp_mainnet"]