# Vault
Vault is a contract that help user to deposit, withdraw and refund in the latest strategy. Vault distribute DAOVault token to user based on shares.

### The smart contract is still under development (testing and auditing) and we strongly advise anyone not to deposit anything on the mainnet until we publicly launch the product.

## Functions
### User functions
#### function `deposit(integar)`
Deposit into strategy.
- *Param*: amount of deposit

#### function `withdraw(integar)`
Withdraw from strategy.
- *Param*: amount of withdraw

#### function `refund()`
Refund from strategy. Only available if strategy in certain condition (for example vesting state).
- *Param*: -

### Admin functions
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

#### function `setTreasuryWallet(address)`
Set new treasury wallet address in contract.
- *Param*: Address of new treasury wallet
- *Event*: eventName: SetTreasuryWallet, args: [oldTreasuryWallet(indexed), newTreasuryWallet(indexed)]

#### function `setCommunityWallet(address)`
Set new community wallet address in contract.
- *Param*: Address of new community wallet
- *Event*: eventName: SetCommunityWallet, args: [oldCommunityWallet(indexed), newCommunityWallet(indexed)]

#### function `setPendingStrategy(address)`
Set new strategy that will be replace old strategy.
- *Param*: New strategy address

#### function `unlockMigrateFunds()`
Unlock `migrateFunds()`. Execute `setPendingStrategy()` will be reverted after execute this function.
- *Param*: -

#### function `migrateFunds()`
Migrate funds from old strategy to new strategy.
- *Param*: -
- *Requirements*: 2 days after execute `unlockMigrateFunds()` and valid for 1 day.  
- *Event*: eventName: MigrateFunds, args: [fromStrategy(indexed), toStrategy(indexed), amount]

### General functions
#### function `vaultName()`
Get vault name
- *Param*: -
- *Return*: Vault name(in data hex string)

#### function `token()`
Get current ERC20 token used.
- *Param*: -
- *Return*: Current ERC20 token address used

#### function `strategy()`
Get current strategy contract used.
- *Param*: -
- *Return*: Current strategy contract address used

#### function `pendingStrategy()`
Get current pending strategy address if got (only use when prepare to change strategy).
- *Param*: -
- *Return*: Current pending strategy address if got

#### function `canSetPendingStrategy()`
Check status whether can set pending strategy (return false when unlock migrate function).
- *Param*: -
- *Return*: Current can set pending strategy status in boolean

#### function `unlockTime()`
Check unlock time for function `migrateFunds()`.
- *Param*: -
- *Return*: Unlock time(seconds since 1970-01-01)

#### function `LOCKTIME()`
Check duration for unlock `migrateFunds()` (unchangable).
- *Param*: -
- *Return*: Duration(seconds)

#### function `networkFeeTier2(integar)`
Get current network fee tier 2, integar input: 0 for minimun, 1 for maximun.
Network fee has three tier. Tier 1: deposit amount < minimun. Tier 2: minimun <= deposit amount <= maximum. Tier 3: maximun < deposit amount.
- *Param*: -
- *Return*: Current network fee tier 2(minimun/maximun)

#### function `customNetworkFeeTier()`
Get current custom network fee tier.
- *Param*: -
- *Return*: Current custom network fee tier

#### function `networkFeePercentage(integar)`
Get current network fee percentage, integar input: 0 for tier1perc, 1 for tier2perc, 2 for tier3perc.
- *Param*: -
- *Return*: Current network fee percentage(tier1perc/tier2perc/tier3perc, 100 = 1%)

#### function `customNetworkFeePercentage()`
Get current custom network fee percentage.
- *Param*: -
- *Return*: Current custom network fee percentage(100 = 1%)

#### function `treasuryWallet()`
Get current treasury wallet.
- *Param*: -
- *Return*: Current treasury wallet address

#### function `communityWallet()`
Get current community wallet.
- *Param*: -
- *Return*: Current community wallet address

#### function `balanceOf(address)`
Check balance of dvmToken.
- *Param*: Address to check
- *Return*: Balance of dvmToken

#### function `totalSupply()`
Get current total supply token to investor.
- *Param*: -
- *Return*: Current total supply amount

#### function `owner()`
Get current owner of the contract.
- *Param*: -
- *Return*: Current owner address of the contract