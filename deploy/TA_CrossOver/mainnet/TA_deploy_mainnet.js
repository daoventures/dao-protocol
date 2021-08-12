const {ethers} = require('hardhat')
const {mainnet: addresses} = require("../../../addresses/TA_Crossover")

module.exports = async ({deployments}) => {
    const {deploy, catchUnknownSigner} = deployments
    const [deployer] = await ethers.getSigners()

    const strategy = await deploy("TAstrategy",{
        from: deployer.address,
        args:[addresses.ADDRESSES.treasuryWallet, addresses.ADDRESSES.communityWallet,
            addresses.ADDRESSES.strategist,0]
    })

    let vault;

    await catchUnknownSigner(
      (vault = deploy("TAvault", {
        from: deployer.address,
        proxyContract: "OpenZeppelinTransparentProxy",
        proxy: {
          owner: deployer.address, // Owner of proxy
          methodName: "initialize", // Method to execute when deploying proxy
        },
        args: [strategy.address, addresses.ADDRESSES.treasuryWallet, 
          addresses.ADDRESSES.communityWallet, addresses.ADDRESSES.adminAddress,
          addresses.ADDRESSES.strategist, addresses.ADDRESSES.trustedForwarder],
      }))
    );

    const TAStrategy = await ethers.getContract("TAstrategy")

    await TAStrategy.connect(deployer).setVault((await vault).address)
    let impl = await ethers.getContract("TAvault_Implementation")

    console.log("Vault: ", (await vault).address)
    console.log('Implementation address', impl.address)
    console.log("Strategy: ", strategy.address)
}

module.exports.tags = ["ta_mainnet"]