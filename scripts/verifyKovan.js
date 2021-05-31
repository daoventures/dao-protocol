const { run } = require('hardhat')

const vaultAddress = "0x542a42496C96b946324f7dce2B030d5643d9eF8A" // copy from deployKovan.js output
const strategyAddress = "0x4996b12560B9A4A85DD437A3e8ff489335dCffA7" // copy from deployKovan.js output

async function main() {
  const [deployer] = await ethers.getSigners()

  // Verify vault contract
  await run('verify:verify', {
    address: vaultAddress,
    constructorArguments: [
      strategyAddress,
      '0x59E83877bD248cBFe392dbB5A8a29959bcb48592', // Treasury wallet
      '0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0', // Community wallet
      deployer.address, // Admin
      '0x54D003d451c973AD7693F825D5b78Adfc0efe934', // Strategist
      '0x84a0856b038eaAd1cC7E297cF34A7e72685A8693', // Biconomy
    ],
    contract: 'contracts/vaults/CitadelVaultKovan.sol:CitadelVaultKovan',
  })

  // Verify strategy contract
  await run('verify:verify', {
    address: strategyAddress,
    constructorArguments: [
      '0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0', // Community wallet
      '0x54D003d451c973AD7693F825D5b78Adfc0efe934', // Strategist
      deployer.address, // Admin
    ],
    contract:
      'contracts/strategies/CitadelStrategyKovan.sol:CitadelStrategyKovan',
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })