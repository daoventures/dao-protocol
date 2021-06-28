async function main() {
  const [deployer] = await ethers.getSigners()
  const ElonApeStrategy = await ethers.getContractFactory(
    'ElonApeStrategy',
    deployer,
  )
  const elonApeStrategy = await ElonApeStrategy.deploy([3333, 3333, 3333], {
    gasLimit: 9000000,
  })
  const ElonApeVault = await ethers.getContractFactory('ElonApeVault', deployer)
  const elonApeVault = await ElonApeVault.deploy(
    elonApeStrategy.address,
    '0x59E83877bD248cBFe392dbB5A8a29959bcb48592', // Treasury wallet
    '0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0', // Community wallet
    '0x3f68A3c1023d736D8Be867CA49Cb18c543373B99', // Admin
    '0x54D003d451c973AD7693F825D5b78Adfc0efe934', // Strategist
    '0x84a0856b038eaAd1cC7E297cF34A7e72685A8693', // Biconomy
    { gasLimit: 9000000 },
  )
  await elonApeStrategy.setVault(elonApeVault.address)

  console.log('ElonApe vault address:', elonApeVault.address)
  console.log('ElonApe strategy address:', elonApeStrategy.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
