const { ethers } = require("hardhat");
const treasuryAddress = "0xa0dF38059f1a49787A36586260f702e7cceAb834"
const adminAddress ="0x6AC8279a136FCa4E6deD18CB6Cc434B63eaA336f"
const communityWallet = "0x4BAF9E5AA965fB2C4919CD996d37aA592e6013C7"
const strategist = "0xa7376b9Ce9207E4211BD651b849f63285Cb7b57A"
const biconomy = "0x9399BB24DBB5C4b782C70c2969F58716Ebbd6a3b"
//const strategy = "0x30610f43990911a56b9d537cf55e7a78661bbd21"
async function main() {
    const [deployer] = await ethers.getSigners()
    const strategy = await ethers.getContractFactory("MoneyPrinterStrategyTestnet", deployer) 
    const moneyPrinterStrategy = await strategy.deploy(treasuryAddress,{gasPrice:3000000000})
    

    const vault = await ethers.getContractFactory("MoneyPrinterVaultTestnet", deployer)
    const moneyPrinterVault = await vault.deploy(moneyPrinterStrategy.address, adminAddress, treasuryAddress, 
        communityWallet, strategist, biconomy,{gasPrice:3000000000});
    await moneyPrinterStrategy.connect(deployer).setVault(moneyPrinterVault.address)

    console.log("Vault deployed to:", moneyPrinterVault.address);
    console.log("Strategy deployed to:", moneyPrinterStrategy.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });