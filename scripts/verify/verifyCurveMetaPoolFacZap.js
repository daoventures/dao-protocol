const { run } = require('hardhat')

const curveMetaPoolFacZap = "" // copy from deployCurveMetaPoolFacZap.js output

async function main() {
    await run('verify:verify', {
        address: curveMetaPoolFacZap,
        contract: 'contracts/zaps/CurveMetaPoolFacZap.sol:CurveMetaPoolFacZap',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })