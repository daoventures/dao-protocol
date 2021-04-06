# Vault Factory
Vault Factory is a contract that create Vault contract for interact with specific stategy.

### The smart contract is still under development (testing and auditing) and we strongly advise anyone not to deposit anything on the mainnet until we publicly launch the product.

## Functions
### User functions
#### function `vaults(integar)`
List of vaults query by index. 
- *Param*: index
- *Return*: Address of querying vault

#### function `vaultTemplate()`
Get current vault template token used.
- *Param*: -
- *Return*: Current vault template address used

### Admin functions
#### function `createVault(bytes32, address, address)`
Create a new vault contract
- *Param*: 
  - Vault name(in data hex string)
  - Token address
  - Strategy address that interact with
