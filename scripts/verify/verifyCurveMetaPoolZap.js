const { run } = require('hardhat')

const curveMetaPoolZap = "" // copy from deployCurveMetaPoolZap.js output

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