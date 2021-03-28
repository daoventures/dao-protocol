# Vault
Vault is a contract that help user to deposit, withdraw and refund in the latest strategy. Vault distribute daoToken to user based on shares.

### The smart contract is still under development (testing and auditing) and we strongly advise anyone not to deposit anything on the mainnet until we publicly launch the product.

## Functions
### User functions
#### function `deposit(list)`
Deposit into strategy.
- *Param*: number list [first amount, second amount]

#### function `withdraw(list)`
Withdraw from strategy.
- *Param*: number list [first amount, second amount]

#### function `refund()`
Refund from strategy. Only available if strategy in certain condition (for example vesting state).
- *Param*: -

### Admin functions
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

#### function `balanceOf(address)`
Check balance of dvmToken.
- *Param*: Address to check
- *Return*: Balance of dvmToken

