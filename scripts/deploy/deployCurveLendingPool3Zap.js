async function main() {
    const [deployer] = await ethers.getSigners()
    const CurveZap = await ethers.getContractFactory("CurveLendingPool3Zap", deployer)
    const curveZap = await CurveZap.deploy({ gasLimit: 9000000 })

    console.log('CurveLendingPool3Zap address:', curveZap.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })