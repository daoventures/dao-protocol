const { run } = require('hardhat')

const vaultAddress = "0xb188767Bcc0bd2e5Baa9D76a82b733e1Fb5aCa2A" // copy from deployKovan.js output
const strategyAddress = "0x614e08044d53436116B778EB79242526C31F86dF" // copy from deployKovan.js output

async function main() {
  // Verify vault contract
  await run('verify:verify', {
    address: vaultAddress,
    constructorArguments: [
      strategyAddress,
      '0x59E83877bD248cBFe392dbB5A8a29959bcb48592', // Treasury wallet
      '0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0', // Community wallet
      '0x3f68A3c1023d736D8Be867CA49Cb18c543373B99', // Admin
      '0x54D003d451c973AD7693F825D5b78Adfc0efe934', // Strategist
      '0xF82986F574803dfFd9609BE8b9c7B92f63a1410E', // Biconomy
    ],
    contract: 'contracts/vaults/CubanApeVaultKovan.sol:CubanApeVaultKovan',
  })

  // Verify strategy contract
  await run('verify:verify', {
    address: strategyAddress,
    constructorArguments: [[1500, 1500, 1400, 1400, 1400, 1400, 1400]],
    contract:
      'contracts/strategies/CubanApeStrategyKovan.sol:CubanApeStrategyKovan',
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
