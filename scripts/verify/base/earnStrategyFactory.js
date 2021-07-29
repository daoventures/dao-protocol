const { run } = require('hardhat')

const earnStrategyFactory = "" // from deploy/base/earnStrategyFactory.js

async function main() {
    await run('verify:verify', {
        address: earnStrategyFactory,
        contract: 'contracts/factories/EarnStrategyFactory.sol:EarnStrategyFactory',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })