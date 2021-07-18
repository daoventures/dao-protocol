async function main() {
    const [deployer] = await ethers.getSigners()
    const EarnStrategyTemplate = await ethers.getContractFactory("EarnStrategy", deployer)
    const earnStrategyTemplate = await EarnStrategyTemplate.deploy({ gasLimit: 9000000 })
    const EarnStrategyFactory = await ethers.getContractFactory("EarnStrategyFactory", deployer)
    const earnStrategyFactory = await EarnStrategyFactory.deploy()

    console.log('EarnStrategyTemplate address:', earnStrategyTemplate.address)
    console.log('EarnStrategyFactory address:', earnStrategyFactory.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })