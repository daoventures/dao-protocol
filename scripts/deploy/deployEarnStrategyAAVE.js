async function main() {
    const [deployer] = await ethers.getSigners()
    const EarnStrategyAAVETemplate = await ethers.getContractFactory("EarnStrategyAAVE", deployer)
    const earnStrategyAAVETemplate = await EarnStrategyAAVETemplate.deploy({ gasLimit: 9000000 })

    console.log('EarnStrategyAAVETemplate address:', earnStrategyAAVETemplate.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })