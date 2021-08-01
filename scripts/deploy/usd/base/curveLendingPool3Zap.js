async function main() {
    let result = "SUCCESS"

    const [deployer] = await ethers.getSigners()
    const CurveZap = await ethers.getContractFactory("CurveLendingPool3Zap", deployer)
    const curveZap = await CurveZap.deploy({ gasLimit: 9000000 })

    try {
        await curveZap.deployTransaction.wait()
    } catch(error) {
        if(error.receipt.status == 0) {
            result = "FAILED"
        }
    }

    console.log('CurveLendingPool3Zap address:', curveZap.address, result)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })