const { run } = require('hardhat')

const earnStrategyAAVETemplate = "" // from deploy/usd/base/earnStrategyAAVE.js

async function main() {
    await run('verify:verify', {
        address: earnStrategyAAVETemplate,
        contract: 'contracts/strategies/EarnStrategyAAVE.sol:EarnStrategyAAVE',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })