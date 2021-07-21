const { run } = require('hardhat')

const curveLendingPool3Zap = "" // copy from deployCurveLendingPool3Zap.js output

async function main() {
    await run('verify:verify', {
        address: curveLendingPool3Zap,
        contract: 'contracts/zaps/CurveLendingPool3Zap.sol:CurveLendingPool3Zap',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })