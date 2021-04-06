# Strategy Factory
Strategy Factory is a contract that create Strategy contract that invest token into Harvest Finance strategy.

### The smart contract is still under development (testing and auditing) and we strongly advise anyone not to deposit anything on the mainnet until we publicly launch the product.

## Functions
### User functions
#### function `strategies(integar)`
List of strategies query by index. 
- *Param*: index
- *Return*: Address of querying strategy

#### function `strategyTemplate()`
Get current strategy template token used.
- *Param*: -
- *Return*: Current strategy template address used

### Admin functions
#### function `createStrategy(bytes32, address, address, address, address, address, address)`
Create a new strategy contract
- *Param*: 
  - Strategy name(in data hex string)
  - Token address
  - Harvest Finance Vault contract address
  - Harvest Finance Stake contract address
  - FARM token address
  - Uniswap Router V2 address
  - WETH token address
