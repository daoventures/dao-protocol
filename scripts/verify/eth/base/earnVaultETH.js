const { run } = require('hardhat')

// earnVaultAddr (not proxy) can be found in folder .openzeppelin -> mainnet.json -> impls -> address
const earnVaultAddr = ""

async function main() {
    await run('verify:verify', {
        address: earnVaultAddr,
        contract: 'contracts/vaults/EarnVaultETH.sol:EarnVaultETH',
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })