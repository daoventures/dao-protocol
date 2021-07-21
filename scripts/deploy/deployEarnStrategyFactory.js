async function main() {
    const [deployer] = await ethers.getSigners()
    const EarnStrategyFactory = await ethers.getContractFactory("EarnStrategyFactory", deployer)
    const earnStrategyFactory = await EarnStrategyFactory.deploy({ gasLimit: 9000000 })

    console.log('EarnStrategyFactory address:', earnStrategyFactory.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })