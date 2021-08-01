const { run } = require('hardhat')

const curveSBTCZap = "" // from deploy/btc/base/curveSBTCZap.js

async function main() {
    await run('verify:verify', {
        address: curveSBTCZap,
        contract: 'contracts/zaps/CurveSBTCZap.sol:CurveSBTCZap',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })