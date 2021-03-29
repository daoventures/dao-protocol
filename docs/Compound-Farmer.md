# Compound-Farmer
Compound-Farmer is a lending platform that build on top of Compound protocol. It let user to lend token to Compound. When it come to withdraw, Compound Farmer withdraw token from Compound with profit, claim distributed COMP token and swap them to token same as lending token, adding the amount of user's profit gained.

### The smart contract is still under development (testing and auditing) and we strongly advise anyone not to deposit anything on the mainnet until we publicly launch the product.

## Functions
### User functions
#### function `deposit(list)`
Lending token to Compound. This function only can access through DAOVault contract.
- *Param*: deposit amount

#### function `withdraw(list)`
Withdraw token from Compound with profit plus exchanged token from COMP token. This function only can access through DAOVault contract.
- *Param*: withdraw amount

#### function `refund()`
Refund from Compound-Farmer contract with profit plus exchanged token from COMP token. This function only can access through DAOVault contract. This function only available after Compound-Farmer in vesting state.
- *Param*: -

#### function `getCurrentBalance(address)`
Get current balance in contract
- *Param*: Address to query
- *Return*: 
  - total user deposit balance after fee if not vesting state
  - user available balance to refund including profit if in vesting state

### Admin functions
#### function `setTreasuryWallet(address)`
Set new treasury wallet address in contract.
- *Param*: Address of new treasury wallet
- *Event*: eventName: SetTreasuryWallet, args: [oldTreasuryWallet(indexed), newTreasuryWallet(indexed)]

#### function `setCommunityWallet(address)`
Set new community wallet address in contract.
- *Param*: Address of new community wallet
- *Event*: eventName: SetCommunityWallet, args: [oldCommunityWallet(indexed), newCommunityWallet(indexed)]

#### function `setNetworkFeeTier2(list)`
Set new network fee tier 2. Network fee is collect in deposit.
Network fee has three tier. Tier 1: deposit amount < minimun. Tier 2: minimun <= deposit amount <= maximum. Tier 3: maximun < deposit amount.
- *Param*: number list [minimum, maximum]
- *Event*: eventName: SetNetworkFeeTier2, args: [[oldNetworkFeeTier2], [newNetworkFeeTier2]]

#### function `setCustomNetworkFeeTier(integar)`
Set new custom network fee tier. Network fee is collect in deposit.
Custom network fee tier can be treat as tier4. Please check networkFeeTier[1] before set.
- *Param*: integar
- *Event*: eventName: SetCustomNetworkFeeTier, args: [oldCustomNetworkFeeTier, newCustomNetworkFeeTier]

#### function `setNetworkFeePercentage(list)`
Set new network fee percentage. Network fee has three tier. Network fee is collect in deposit.
- *Param*: number list [tier1perc, tier2perc, tier3perc] (100 = 1%, maximum 2999)
- *Event*: eventName: SetNetworkFeePercentage, args: [[oldNetworkFeePercentage], [newNetworkFeePercentage]]

#### function `setCustomNetworkFeePercentage(integar)`
Set new custom network fee percentage. Network fee is collect in deposit. Amount set must less than network fee for tier 3.
- *Param*: integar (100 = 1%)
- *Event*: eventName: SetCustomNetworkFeePercentage, args: [oldCustomNetworkFeePercentage, newCustomNetworkFeePercentage]

#### function `setProfileSharingFeePercentage(integar)`
Set new profile sharing fee percentage. Profile sharing fee is collect in withdraw(if profit).
- *Param*: integer (100 = 1%, maximun 2999)
- *Event*: eventName: SetProfileSharingFeePercentage, args: [oldProfileSharingFeePercentage, newProfileSharingFeePercentage]

#### function `setAmountOutMinPerc(integar)`
Set new amount out minimun percentage for Uniswap swap funtion.
- *Param*: integer (100 = 1%, maximun 9700)

#### function `setDeadline(integar)`
Set new deadline for Uniswap swap funtion.
- *Param*: integer (seconds, minimum 60)

#### function `vesting()`
Make contract in vesting state. Withdraw all balance from Compound, swap all distributed COMP token to underlying token. Block user interaction function `deposit()` and `withdraw()`.
- *Param*: -

#### function `revertVesting()`
Revert this contract to working normally from vesting state, restore `deposit()` and `withdraw` functions.
- *Param*: -

#### function `approveMigrate()`
Allow DAOVault to move funds in this contract. This function only available after Compound-Farmer in vesting state.
- *Param*: -

### General functions
#### function `token()`
Get ERC20 token used.
- *Param*: -
- *Return*: ERC20 token address used

#### function `cToken()`
Get Compound cERC20 token used.
- *Param*: -
- *Return*: Compound cERC20 token address used

#### function `compToken()`
Get Compound COMP token used.
- *Param*: -
- *Return*: COMP token address used

#### function `comptoller()`
Get Compound comptroller contract used.
- *Param*: -
- *Return*: Comptroller contract address used

#### function `uniswapRouter()`
Get Uniswap router contract used.
- *Param*: -
- *Return*: Uniswap router contract address used

#### function `DAOVault()`
Get DAOVault contract used.
- *Param*: -
- *Return*: DAOVault contract address used

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

#### function `treasuryWallet()`
Get current treasury wallet.
- *Param*: -
- *Return*: Current treasury wallet address

#### function `communityWallet()`
Get current community wallet.
- *Param*: -
- *Return*: Current community wallet address

#### function `networkFeeTier2()`
Get current network fee tier 2 ([minimun, maximun]).
Network fee has three tier. Tier 1: deposit amount < minimun. Tier 2: minimun <= deposit amount <= maximum. Tier 3: maximun < deposit amount.
- *Param*: -
- *Return*: Current network fee tier 2(list)

#### function `customNetworkFeeTier()`
Get current custom network fee tier.
- *Param*: -
- *Return*: Current custom network fee tier

#### function `DENOMINATOR()`
Get denominator for calculate percentage.
- *Param*: -
- *Return*: Denominator for calculate percentage(10000)

#### function `networkFeePercentage()`
Get current network fee percentage ([tier1perc, tier2perc, tier3perc]).
- *Param*: -
- *Return*: Current network fee percentage(100 = 1%)

#### function `customNetworkFeePercentage()`
Get current custom network fee percentage.
- *Param*: -
- *Return*: Current custom network fee percentage(100 = 1%)

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
