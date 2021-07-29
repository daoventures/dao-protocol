async function main() {
    let result = "SUCCESS"

    const [deployer] = await ethers.getSigners()
    const EarnStrategyAAVETemplate = await ethers.getContractFactory("EarnStrategyAAVE", deployer)
    const earnStrategyAAVETemplate = await EarnStrategyAAVETemplate.deploy({ gasLimit: 9000000 })

    try {
        await earnStrategyAAVETemplate.deployTransaction.wait()
    } catch(error) {
        if(error.receipt.status == 0) {
            result = "FAILED"
        }
    }

    console.log('EarnStrategyAAVETemplate address:', earnStrategyAAVETemplate.address, result)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })