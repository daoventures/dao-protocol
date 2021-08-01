const { run } = require('hardhat')

const curvePlainPoolZap = "" // from deploy/usd/base/curvePlainPoolZap.js

async function main() {
    await run('verify:verify', {
        address: curvePlainPoolZap,
        contract: 'contracts/zaps/CurvePlainPoolZap.sol:CurvePlainPoolZap',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })