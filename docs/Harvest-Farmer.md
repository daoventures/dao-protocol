# Harvest Farmer
Harvest-Farmer is a yield aggregator platform that build on top of Harvest Finance protocol. It let user to deposit token to Harvest Finance strategy and stake the fAsset(LP Token) that received to earn FARM token. When it come to withdraw, Harvest-Farmer withdraw token from Harvest Finance with profit, claim mined FARM token and swap them to token same as deposit token, adding the total amount of user's profit gained.

### The smart contract is still under development (testing and auditing) and we strongly advise anyone not to deposit anything on the mainnet until we publicly launch the product.

## Functions
### User functions
#### function `deposit(list)`
Deposit token to Harvest Finance strategy. This function only can access through DAOVault contract.
- *Param*: deposit amount

#### function `withdraw(list)`
Withdraw token from Harvest Finance Vault with profit plus exchanged token from COMP token. This function only can access through DAOVault contract.
- *Param*: withdraw amount

#### function `refund()`
Refund from Harvest-Farmer contract with profit plus exchanged token from COMP token. This function only can access through DAOVault contract. This function only available after Harvest-Farmer in vesting state.
- *Param*: -

### Admin functions
#### function `setTreasuryWallet(address)`
Set new treasury wallet address in contract.
- *Param*: Address of new treasury wallet
- *Event*: eventName: SetTreasuryWallet, args: [oldTreasuryWallet(indexed), newTreasuryWallet(indexed)]

#### function `setCommunityWallet(address)`
Set new community wallet address in contract.
- *Param*: Address of new community wallet
- *Event*: eventName: SetCommunityWallet, args: [oldCommunityWallet(indexed), newCommunityWallet(indexed)]

#### function `setProfileSharingFeePercentage(integar)`
Set new profile sharing fee percentage. Profile sharing fee is collect in withdraw(if profit).
- *Param*: integer (100 = 1%, maximun 2999)
- *Event*: eventName: SetProfileSharingFeePercentage, args: [oldProfileSharingFeePercentage, newProfileSharingFeePercentage]

#### function `setAmountOutMinPerc(integar)`
Set new amount out minimun percentage for Uniswap swap funtion.
- *Param*: integer (100 = 1%, maximun 9700)

#### function `vesting()`
Make contract in vesting state. Withdraw all balance from Harvest Finance, swap all mined FARM token to underlying token. Block user interaction function `deposit()` and `withdraw()`.
- *Param*: -

#### function `revertVesting()`
Revert this contract to working normally from vesting state, restore `deposit()` and `withdraw` functions.
- *Param*: -

#### function `approveMigrate()`
Allow DAOVault to move funds in this contract. This function only available after Harvest-Farmer in vesting state.
- *Param*: -

#### function `reuseContract()`
Reuse this contract after vesting and funds migrated. Use this function only for fallback reason(new strategy have issue and replace strategy haven't ready yet).
- *Param*: -

### General functions
#### function `strategyName()`
Get strategy name
- *Param*: -
- *Return*: Strategy name(in data hex string)

#### function `token()`
Get ERC20 token used.
- *Param*: -
- *Return*: ERC20 token address used

#### function `daoVault()`
Get DAOVault contract used.
- *Param*: -
- *Return*: DAOVault contract address used

#### function `hfVault()`
Get Harvest Finance Vault contract used.
- *Param*: -
- *Return*: Harvest Finance Vault contract address used

#### function `hfStake()`
Get Harvest Finance Stake contract used.
- *Param*: -
- *Return*: Harvest Finance Stake contract address used

#### function `FARM()`
Get FARM token address.
- *Param*: -
- *Return*: FARM token address

#### function `uniswapRouter()`
Get Uniswap router contract used.
- *Param*: -
- *Return*: Uniswap router contract address used

#### function `WETH()`
Get WETH token used.
- *Param*: -
- *Return*: WETH token address used

#### function `isVesting()`
Get current vesting state.
- *Param*: -
- *Return*: Current vesting state in boolean

#### function `pool()`
Get current accumulate pool.
- *Param*: -
- *Return*: Current accumulate pool amount

#### function `amountOutMinPerc()`
Get current amount out minimum percentage for Uniswap swap function used.
- *Param*: -
- *Return*: Current amount out minimum percentage used(100 = 1%)

#### function `deadline()`
Get current deadline used.
- *Param*: -
- *Return*: Current deadline used(in seconds)

#### function `profileSharingFeePercentage()`
Get current profile sharing fee percentage.
- *Param*: -
- *Return*: Current profile sharing fee percentage(100 = 1%)

#### function `totalSupply()`
Get current total supply token to DAOVault.
- *Param*: -
- *Return*: Current total supply amount

#### function `owner()`
Get current owner of the contract.
- *Param*: -
- *Return*: Current owner address of the contract
