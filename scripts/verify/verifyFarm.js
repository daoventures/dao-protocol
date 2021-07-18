const { run } = require('hardhat')
const { mainnet } = require("../../addresses/index")

const earnVaultAddr = "" // copy from deployFarm.js output
const earnStrategyAddr = "" // copy from deployFarm.js output

async function main() {
    await run('verify:verify', {
        address: earnVaultAddr,
        contract: 'contracts/strategies/EarnVault.sol:EarnVault',
    })
    await run('verify:verify', {
        address: earnStrategyAddr,
        contract: 'contracts/factories/EarnStrategyFactory.sol:EarnStrategy',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })