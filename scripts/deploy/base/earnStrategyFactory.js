async function main() {
    let result = "SUCCESS"

    const [deployer] = await ethers.getSigners()
    const EarnStrategyFactory = await ethers.getContractFactory("EarnStrategyFactory", deployer)
    const earnStrategyFactory = await EarnStrategyFactory.deploy({ gasLimit: 9000000 })

    try {
        await earnStrategyFactory.deployTransaction.wait()
    } catch(error) {
        if(error.receipt.status == 0) {
            result = "FAILED"
        }
    }

    console.log('EarnStrategyFactory address:', earnStrategyFactory.address, result)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })