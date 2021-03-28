# Yearn-Farmer v2
Yearn-Farmer V2 is a lending aggregator that build on top of Yearn Finance. User can choose to deposit between Yearn Earn or Vault through DAOVault.

### The smart contract is still under development (testing and auditing) and we strongly advise anyone not to deposit anything on the mainnet until we publicly launch the product.

## Functions
### User functions
#### function `deposit(list)`
Deposit into Yearn Earn and Vault contract. This function only can access through daoVault contract.
- *Param*: number list [Yearn Earn deposit amount, Yearn Vault deposit amount]

#### function `withdraw(list)`
Withdraw from Yearn Earn and Vault contract. This function only can access through daoVault contract.
- *Param*: number list [Yearn Earn withdraw shares, Yearn Vault withdraw shares]
> Get Yearn Earn/Vault withdraw shares from Yearn-Farmer v2 through getEarnDepositBalance()/getVaultDepositBalance(). Deposit balance = shares amount. This is for the very first strategy only(before vesting).

#### function `refund()`
Refund from Yearn-Farmer contract. This function only can access through daoVault contract. This function only available after Yearn-Farmer in vesting state.
- *Param*: -

#### function `getEarnDepositBalance(address)`
Get Yearn Earn current total deposit amount of account (after network fee).
- *Param*: Address of account to check
- *Return*: Current total deposit amount of account in Yearn Earn (after network fee).

#### function `getVaultDepositBalance(address)`
Get Yearn Vault current total deposit amount of account (after network fee).
- *Param*: Address of account to check
- *Return*: Current total deposit amount of account in Yearn Vault (after network fee).

#### function `getSharesValue(address)`
Get token amount based on daoToken hold by account after contract in vesting state.
- *Param*: Address of account to check
- *Return*: Token amount based on on daoToken hold by account. 0 if contract is not in vesting state

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

#### function `setNetworkFeePercentage(list)`
Set new network fee percentage. Network fee has three tier. Network fee is collect in deposit.
- *Param*: number list [tier1perc, tier2perc, tier3perc] (100 = 1%, maximum 3999)
- *Event*: eventName: SetNetworkFeePercentage, args: [[oldNetworkFeePercentage], [newNetworkFeePercentage]]

#### function `setCustomNetworkFeeTier(integar)`
Set new custom network fee tier. Network fee is collect in deposit.
Custom network fee tier is checked before network fee tier 3 when calculate network fee.
Please make sure custom network fee tier amount is higher than network fee tier 3.
- *Param*: number list [minimum, maximum]
- *Event*: eventName: SetCustomNetworkFeeTier, args: [oldCustomNetworkFeeTier, newCustomNetworkFeeTier]

#### function `setCustomNetworkFeePercentage(integar)`
Set new custom network fee percentage. Network fee is collect in deposit.
- *Param*: integar (100 = 1%)
- *Event*: eventName: SetCustomNetworkFeePercentage, args: [oldCustomNetworkFeePercentage, newCustomNetworkFeePercentage]

#### function `setProfileSharingFeePercentage(integar)`
Set new profile sharing fee percentage. Profile sharing fee is collect in withdraw(if profit).
- *Param*: integer (1 = 1%, maximun 39)
- *Event*: eventName: SetProfileSharingFeePercentage, args: [oldProfileSharingFeePercentage, newProfileSharingFeePercentage]

#### function `vesting()`
Make contract in vesting state. Withdraw all balance from Yearn Earn and Vault contract. Block user interaction function `deposit()` and `withdraw()`. `getEarnDepositBalance()` and `getVaultDepositBalance()` return 0. (use `getSharesValue()` instead)
- *Param*: -

#### function `approveMigrate()`
Allow daoVault to move funds in this contract.
- *Param*: -
- *Requirements*: Contract in vesting state

### General functions
#### function `token()`
Get current ERC20 token used.
- *Param*: -
- *Return*: Current ERC20 token address used

#### function `earn()`
Get current Yearn Earn contract used.
- *Param*: -
- *Return*: Current Yearn Earn contract address used

#### function `vault()`
Get current Yearn Vault contract used.
- *Param*: -
- *Return*: Current Yearn Vault contract address used

#### function `pool()`
Get current accumulate pool.
- *Param*: -
- *Return*: Current accumulate pool amount

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
- *Return*: Current network fee tier 2

#### function `customNetworkFeeTier()`
Get current custom network fee tier.
- *Param*: -
- *Return*: Current custom network fee tier

#### function `networkFeePercentage()`
Get current network fee percentage ([tier1perc, tier2perc, tier3perc]). 100 = 1%.
- *Param*: -
- *Return*: Current network fee percentage in amount

#### function `customNetworkFeePercentage()`
Get current custom network fee percentage. 100 = 1%.
- *Param*: -
- *Return*: Current custom network fee percentage in amount

#### function `profileSharingFeePercentage()`
Get current profile sharing fee percentage. 100 = 1%.
- *Param*: -
- *Return*: Current profile sharing fee percentage in amount

#### function `isVesting()`
Get current vesting state.
- *Param*: -
- *Return*: Current vesting state in boolean

#### function `daoVault()`
Get current daoVault used.
- *Param*: -
- *Return*: Current daoVault address
