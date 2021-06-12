async function main() {
  const [deployer] = await ethers.getSigners()
  const CubanApeStrategy = await ethers.getContractFactory(
    'CubanApeStrategy',
    deployer,
  )
  const cubanApeStrategy = await CubanApeStrategy.deploy(
    '0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0', // Community wallet
    '0x54D003d451c973AD7693F825D5b78Adfc0efe934', // Strategist
    '0x3f68A3c1023d736D8Be867CA49Cb18c543373B99', // Admin
  )
  const CubanApeVault = await ethers.getContractFactory('CubanApeVault', deployer)
  const cubanApeVault = await CubanApeVault.deploy(
    cubanApeStrategy.address,
    '0x59E83877bD248cBFe392dbB5A8a29959bcb48592', // Treasury wallet
    '0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0', // Community wallet
    '0x3f68A3c1023d736D8Be867CA49Cb18c543373B99', // Admin
    '0x54D003d451c973AD7693F825D5b78Adfc0efe934', // Strategist
    '0x84a0856b038eaAd1cC7E297cF34A7e72685A8693', // Biconomy
  )
  await cubanApeStrategy.setVault(cubanApeVault.address)

  console.log('ElonApe vault address:', cubanApeVault.address)
  console.log('ElonApe strategy address:', cubanApeStrategy.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })