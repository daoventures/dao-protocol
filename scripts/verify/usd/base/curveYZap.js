const { run } = require('hardhat')

const curveYZap = "" // from deploy/usd/base/curveYZap.js

async function main() {
    await run('verify:verify', {
        address: curveYZap,
        contract: 'contracts/zaps/CurveYZap.sol:CurveYZap',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })