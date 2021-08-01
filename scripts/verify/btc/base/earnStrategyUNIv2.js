const { run } = require('hardhat')

const earnStrategyTemplate = "" // from deploy/usd/base/earnStrategyUNIv2.js

async function main() {
    await run('verify:verify', {
        address: earnStrategyTemplate,
        contract: 'contracts/strategies/EarnStrategyUNIv2.sol:EarnStrategyUNIv2',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })