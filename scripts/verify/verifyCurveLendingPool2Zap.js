const { run } = require('hardhat')

const curveLendingPool2Zap = "" // copy from deployCurveLendingPool2Zap.js output

async function main() {
    await run('verify:verify', {
        address: curveLendingPool2Zap,
        contract: 'contracts/zaps/CurveLendingPool2Zap.sol:CurveLendingPool2Zap',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })