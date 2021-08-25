const { ethers, network, artifacts, upgrades } = require("hardhat");
const { mainnet: network_ } = require('../../addresses/uniL1');

module.exports = async ({ deployments }) => {
    const { deploy, catchUnknownSigner } = deployments;
    const [deployer] = await ethers.getSigners();

    let Factory = await ethers.getContract("uniVaultFactory")

    
    let implArtifacts = await artifacts.readArtifact("uniVault")
    
    let implABI = implArtifacts.abi


    let implInterfacec = new ethers.utils.Interface(implABI)
    let data = implInterfacec.encodeFunctionData("initialize", [network_.TOKENS.GHST, network_.TOKENS.WETH, network_.ADDRESSES.adminAddress,
    network_.ADDRESSES.communityWallet, network_.ADDRESSES.treasuryWallet, network_.ADDRESSES.strategist, 
    10000, -840000, 840000])

    await Factory.connect(deployer).createVault(data)


};

module.exports.tags = ["uni_mainnet_deploy_GHST_ETH_pool"];
module.exports.dependencies = ["uni_mainnet_deploy_factory"]