const { run } = require('hardhat')

const vaultAddress = "" // copy from deployMainnet.js output
const strategyAddress = "" // copy from deployMainnet.js output

async function main() {
  const [deployer] = await ethers.getSigners()

  // Verify vault contract
  await run('verify:verify', {
    address: vaultAddress,
    constructorArguments: [
      strategyAddress,
      '0x59E83877bD248cBFe392dbB5A8a29959bcb48592', // Treasury wallet
      '0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0', // Community wallet
      '0x3f68A3c1023d736D8Be867CA49Cb18c543373B99', // Admin
      '0x54D003d451c973AD7693F825D5b78Adfc0efe934', // Strategist
      '0x84a0856b038eaAd1cC7E297cF34A7e72685A8693', // Biconomy
    ],
    contract: 'contracts/vaults/ElonApeVault.sol:ElonApeVault',
  })

  // Verify strategy contract
  await run('verify:verify', {
    address: strategyAddress,
    constructorArguments: [[3333, 3333, 3333]],
    contract:
      'contracts/strategies/ElonApeStrategy.sol:ElonApeStrategy',
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
