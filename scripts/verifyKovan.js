const { run } = require('hardhat')

async function main() {
  const [deployer] = await ethers.getSigners()

  // Verify strategy contract
  await run('verify:verify', {
    address: "0x02281600cBf6E072850f8Aa77f03E1C722B3A216",
    constructorArguments: [
      '0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0', // Community wallet
      '0x54D003d451c973AD7693F825D5b78Adfc0efe934', // Strategist
      deployer.address, // Admin
    ],
    contract:
      'contracts/strategies/CitadelStrategyKovan.sol:CitadelStrategyKovan',
  })

  // Verify vault contract
  await run('verify:verify', {
    address: "0x00ba7142D3ea3f59A69cC37BfCeA4CEbf68C63aA",
    constructorArguments: [
      "0x02281600cBf6E072850f8Aa77f03E1C722B3A216",
      '0x59E83877bD248cBFe392dbB5A8a29959bcb48592', // Treasury wallet
      '0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0', // Community wallet
      deployer.address, // Admin
      '0x54D003d451c973AD7693F825D5b78Adfc0efe934', // Strategist
      '0x84a0856b038eaAd1cC7E297cF34A7e72685A8693', // Biconomy
    ],
    contract: 'contracts/vaults/CitadelVaultKovan.sol:CitadelVaultKovan',
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
