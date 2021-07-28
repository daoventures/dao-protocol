const { run, ethers } = require('hardhat')

// earnVaultAddr can be found in folder .openzeppelin -> mainnet.json -> impls -> address
const earnVaultAddr = ""

// earnStrategy contract is minimal proxy contract of earnStrategyTemplate
// so it will automatically been verified
// const earnStrategyAddr = ""

async function main() {
    await run('verify:verify', {
        address: earnVaultAddr,
        contract: 'contracts/vaults/EarnVault.sol:EarnVault',
    })
    // await run('verify:verify', {
    //     address: earnStrategyAddr,
    //     contract: 'contracts/strategies/EarnStrategy.sol:EarnStrategy',
    // })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })