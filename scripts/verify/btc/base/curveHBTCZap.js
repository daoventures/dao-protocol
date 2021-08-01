const { run } = require('hardhat')

const curveHBTCZap = "" // from deploy/btc/base/curveHBTCZap.js

async function main() {
    await run('verify:verify', {
        address: curveHBTCZap,
        contract: 'contracts/zaps/CurveHBTCZap.sol:CurveHBTCZap',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })