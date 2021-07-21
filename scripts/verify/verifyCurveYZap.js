const { run } = require('hardhat')

const curveYZap = "" // copy from deployCurveYZap.js output

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