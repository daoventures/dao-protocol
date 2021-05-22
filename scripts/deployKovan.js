const { run } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners()
    const CitadelStrategy = await ethers.getContractFactory("CitadelStrategyKovan", deployer)
    const citadelStrategy = await CitadelStrategy.deploy(deployer.address, deployer.address, deployer.address)
    const CitadelVault = await ethers.getContractFactory("CitadelVaultKovan", deployer)
    const citadelVault = await CitadelVault.deploy(
        citadelStrategy.address, deployer.address, deployer.address, deployer.address, deployer.address, deployer.address
    )
    await citadelStrategy.setVault(citadelVault.address)

    // verify
    await run("verify:verify", {
      address: citadelStrategy.address,
      constructorArguments: [deployer.address, deployer.address, deployer.address],
      contract: "contracts/CitadelStrategy.sol:CitadelStrategy",
    });

    await run("verify:verify", {
      address: citadelVault.address,
      constructorArguments: [citadelStrategy.address, deployer.address, deployer.address, deployer.address, deployer.address, deployer.address],
      contract: "contracts/CitadelVault.sol:CitadelVault",
    });
  
    console.log('Citadel vault address:', citadelVault.address) // 0x0Bd1B8989c1851880915A64DC2af14407ed378d8
    console.log('Citadel strategy address:', citadelStrategy.address) // 0x0148fFC7f4137bd4FA513CA746E1e405EE085eFA
  }
  
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });