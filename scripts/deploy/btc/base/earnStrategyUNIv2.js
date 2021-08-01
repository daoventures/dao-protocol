async function main() {
    let result = "SUCCESS"

    const [deployer] = await ethers.getSigners()
    const EarnStrategyTemplate = await ethers.getContractFactory("EarnStrategyUNIv2", deployer)
    const earnStrategyTemplate = await EarnStrategyTemplate.deploy({ gasLimit: 9000000 })

    try {
        await earnStrategyTemplate.deployTransaction.wait()
    } catch(error) {
        if(error.receipt.status == 0) {
            result = "FAILED"
        }
    }

    console.log('EarnStrategyUNIv2Template address:', earnStrategyTemplate.address, result)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })