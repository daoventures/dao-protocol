async function main() {
  const [deployer] = await ethers.getSigners()
  const CubanApeStrategy = await ethers.getContractFactory(
    'CubanApeStrategyKovan',
    deployer,
  )
  const cubanApeStrategy = await CubanApeStrategy.deploy([1500, 1500, 1400, 1400, 1400, 1400, 1400])
  const CubanApeVault = await ethers.getContractFactory(
    'CubanApeVaultKovan',
    deployer,
  )
  const cubanApeVault = await CubanApeVault.deploy(
    cubanApeStrategy.address,
    '0x59E83877bD248cBFe392dbB5A8a29959bcb48592', // Treasury wallet
    '0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0', // Community wallet
    '0x3f68A3c1023d736D8Be867CA49Cb18c543373B99', // Admin
    '0x54D003d451c973AD7693F825D5b78Adfc0efe934', // Strategist
    '0xF82986F574803dfFd9609BE8b9c7B92f63a1410E', // Biconomy
  )
  await cubanApeStrategy.setVault(cubanApeVault.address)

  console.log('CubanApe vault address:', cubanApeVault.address)
  console.log('CubanApe strategy address:', cubanApeStrategy.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
