const { run } = require('hardhat')

const curveMetaPoolZap = "" // from deploy/base/curveMetaPoolZap.js

async function main() {
    await run('verify:verify', {
        address: curveMetaPoolZap,
        contract: 'contracts/zaps/CurveMetaPoolZap.sol:CurveMetaPoolZap',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })