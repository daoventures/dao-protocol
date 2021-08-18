const { ethers, network, artifacts, upgrades } = require("hardhat");
const { mainnet: network_ } = require("../../../addresses/optionA");


module.exports = async ({ deployments }) => {
    const { deploy, catchUnknownSigner } = deployments;
    const [deployer] = await ethers.getSigners();

    let Factory = await ethers.getContract("SushiOptionAFactory")

    
    let implArtifacts = await artifacts.readArtifact("DAOVaultOptionA")
    
    let implABI = implArtifacts.abi


    let implInterfacec = new ethers.utils.Interface(implABI)
    let data = implInterfacec.encodeFunctionData("initialize", ["DAOVaultETHUSDC", "daoETHUSDC", network_.poolIDs.ETHUSDC,
    network_.TOKENS.WETH, network_.TOKENS.USDC, network_.TOKENS.ETHUSDCLP,
    network_.ADDRESSES.communityWallet, network_.ADDRESSES.treasuryWallet, network_.ADDRESSES.strategist, network_.ADDRESSES.trustedForwarder, network_.ADDRESSES.adminAddress,
    network_.SUSHI.masterChef, 1])

    await Factory.connect(deployer).createVault(data)


};

module.exports.tags = ["oa_mainnet_deploy_pool"];
module.exports.dependencies = ["oa_mainnet_deploy_factory"]