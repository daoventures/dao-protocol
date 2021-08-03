const { run } = require('hardhat')

const CurvePlainPoolETHZap = "" // from deploy/eth/base/CurvePlainPoolETHZap.js

async function main() {
    await run('verify:verify', {
        address: CurvePlainPoolETHZap,
        contract: 'contracts/zaps/CurvePlainPoolETHZap.sol:CurvePlainPoolETHZap',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })