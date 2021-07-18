const { run } = require('hardhat')

const curveLendingPoolZap = "" // copy from deployCurveLendingPoolZap.js output

async function main() {
    await run('verify:verify', {
        address: curveLendingPoolZap,
        contract: 'contracts/zaps/CurveLendingPoolZap.sol:CurveLendingPoolZap',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })