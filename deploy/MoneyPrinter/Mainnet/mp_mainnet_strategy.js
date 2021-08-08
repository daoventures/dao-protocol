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
    console.log("Strategy: ", strategy.address)
}

module.exports.tags = ["mp_mainnet_strategy"]
