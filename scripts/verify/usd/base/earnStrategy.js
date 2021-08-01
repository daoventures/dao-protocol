const { run } = require('hardhat')

const earnStrategyTemplate = "" // from deploy/usd/base/earnStrategy.js

async function main() {
    await run('verify:verify', {
        address: earnStrategyTemplate,
        contract: 'contracts/strategies/EarnStrategy.sol:EarnStrategy',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })