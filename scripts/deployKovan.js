async function main() {
  const [deployer] = await ethers.getSigners()
  const CitadelStrategy = await ethers.getContractFactory(
    'CitadelStrategyKovan',
    deployer,
  )
  const citadelStrategy = await CitadelStrategy.deploy(
    '0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0', // Community wallet
    '0x54D003d451c973AD7693F825D5b78Adfc0efe934', // Strategist
    deployer.address, // Admin
  )
  const CitadelVault = await ethers.getContractFactory(
    'CitadelVaultKovan',
    deployer,
  )
  const citadelVault = await CitadelVault.deploy(
    citadelStrategy.address,
    '0x59E83877bD248cBFe392dbB5A8a29959bcb48592', // Treasury wallet
    '0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0', // Community wallet
    deployer.address, // Admin
    '0x54D003d451c973AD7693F825D5b78Adfc0efe934', // Strategist
    '0x84a0856b038eaAd1cC7E297cF34A7e72685A8693', // Biconomy
  )
  await citadelStrategy.setVault(citadelVault.address)

  console.log('Citadel vault address:', citadelVault.address)
  console.log('Citadel strategy address:', citadelStrategy.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
