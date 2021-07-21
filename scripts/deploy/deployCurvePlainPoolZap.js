async function main() {
    const [deployer] = await ethers.getSigners()
    const CurveZap = await ethers.getContractFactory("CurvePlainPoolZap", deployer)
    const curveZap = await CurveZap.deploy({ gasLimit: 9000000 })

    console.log('CurvePlainPoolZap address:', curveZap.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })