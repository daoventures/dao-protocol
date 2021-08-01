const { run } = require('hardhat')

const curveMetaPoolBTCZap = "" // from deploy/btc/base/curveMetaPoolBTCZap.js

async function main() {
    await run('verify:verify', {
        address: curveMetaPoolBTCZap,
        contract: 'contracts/zaps/CurveMetaPoolBTCZap.sol:CurveMetaPoolBTCZap',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })