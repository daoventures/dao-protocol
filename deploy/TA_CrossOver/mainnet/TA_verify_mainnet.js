const { ethers, run } = require("hardhat");
const { mainnet: addresses } = require("../../../addresses/TA_Crossover")

module.exports = async () => {
    const strategy = await ethers.getContract("TAvault");
    const vault = await ethers.getContract("TAstrategy");

    //verify implementation
    await run("verify:verify", {
        address: strategy.address,
        contract: "contracts/strategies/TAstrategy.sol:TAstrategy",
        args: [addresses.ADDRESSES.treasuryWallet, addresses.ADDRESSES.communityWallet,
        addresses.ADDRESSES.strategist, 0]
    });

    await run("verify:verify", {
        address: vault.address,
        contract: "contracts/vaults/TAvault.sol:TAvault",
    });

};

module.exports.tags = ["ta_mainnet_verify"];

