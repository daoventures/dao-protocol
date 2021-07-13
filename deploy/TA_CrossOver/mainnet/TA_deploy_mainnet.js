const {ethers} = require('hardhat')
const {mainnet: addresses} = require("../../../addresses/TA_Crossover")

module.exports = async ({deployments}) => {
    const {deploy} = deployments
    const [deployer] = await ethers.getSigners()

    const strategy = await deploy("TAstrategy",{
        from: deployer.address,
        args:[addresses.ADDRESSES.treasuryWallet, addresses.ADDRESSES.communityWallet,
            addresses.ADDRESSES.strategist,0]
    })

    const vault = await deploy("TAvault", {
        from: deployer.address,
        args: [strategy.address, addresses.ADDRESSES.treasuryWallet, 
            addresses.ADDRESSES.communityWallet, addresses.ADDRESSES.adminAddress,
            addresses.ADDRESSES.strategist, addresses.ADDRESSES.trustedForwarder]
    })

    const TAStrategy = await ethers.getContract("TAstrategy")

    await TAStrategy.connect(deployer).setVault(vault.address)

    console.log("Vault: ", vault.address)
    console.log("Strategy: ", strategy.address)
}

module.exports.tags = ["ta_mainnet"]