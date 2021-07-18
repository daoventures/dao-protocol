# DAO Earn Series (USD based - 9 pools)
DAO Earn vault series utilize Curve and Convex protocols to get APY. In high-level, DAO Earn do compounding by sell $CRV, $CVX, and any extra reward from Curve pool to buy more LP token and stake into Convex again.

### Deposit token:-
Pool Name | Available token to deposit
--------- | --------------------------
LUSD | USDT/USDC/DAI/[LUSD](https://etherscan.io/address/0x5f98805A4E8be255a32880FDeC7F6728C6568bA0)/*[LP Token](https://etherscan.io/address/0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA)/[3Crv](https://etherscan.io/address/0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490)/**any token/directly from ETH
BUSDv2 | USDT/USDC/DAI/[BUSD](https://etherscan.io/address/0x4Fabb145d64652a948d72533023f6E7A623C7C53)/*[LP Token](https://etherscan.io/address/0x4807862AA8b2bF68830e4C8dc86D0e9A998e085a)/[3Crv](https://etherscan.io/address/0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490)/**any token/directly from ETH
alUSD | USDT/USDC/DAI/[alUSD](https://etherscan.io/address/0xBC6DA0FE9aD5f3b0d58160288917AA56653660E9)/*[LP Token](https://etherscan.io/address/0x43b4FdFD4Ff969587185cDB6f0BD875c5Fc83f8c)/[3Crv](https://etherscan.io/address/0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490)/**any token/directly from ETH
UST | USDT/USDC/DAI/[UST](https://etherscan.io/address/0xa47c8bf37f92aBed4A126BDA807A7b7498661acD)/*[LP Token](https://etherscan.io/address/0x94e131324b6054c0D789b190b2dAC504e4361b53)/[3Crv](https://etherscan.io/address/0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490)/**any token/directly from ETH
USDN | USDT/USDC/DAI/[USDN](https://etherscan.io/address/0x674C6Ad92Fd080e4004b2312b45f796a192D27a0)/*[LP Token](https://etherscan.io/address/0x4f3E8F405CF5aFC05D68142F3783bDfE13811522)/[3Crv](https://etherscan.io/address/0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490)/**any token/directly from ETH
sUSD | USDT/USDC/DAI/[sUSD](https://etherscan.io/address/0x57Ab1ec28D129707052df4dF418D58a2D46d5f51)/*[LP Token](https://etherscan.io/address/0xC25a3A3b969415c80451098fa907EC722572917F)/**any token/directly from ETH

*Deposit LP token for no slippage & fees by Curve

*any token that available to swap in Sushi.

### Withdraw token:-
Pool Name | Available token to withdraw
--------- | --------------------------
LUSD | USDT/USDC/DAI/[LUSD](https://etherscan.io/address/0x5f98805A4E8be255a32880FDeC7F6728C6568bA0)/[LP Token](https://etherscan.io/address/0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA)
BUSDv2 | USDT/USDC/DAI/[BUSD](https://etherscan.io/address/0x4Fabb145d64652a948d72533023f6E7A623C7C53)/[LP Token](https://etherscan.io/address/0x4807862AA8b2bF68830e4C8dc86D0e9A998e085a)
alUSD | USDT/USDC/DAI/[alUSD](https://etherscan.io/address/0xBC6DA0FE9aD5f3b0d58160288917AA56653660E9)/[LP Token](https://etherscan.io/address/0x43b4FdFD4Ff969587185cDB6f0BD875c5Fc83f8c)
UST | USDT/USDC/DAI/[UST](https://etherscan.io/address/0xa47c8bf37f92aBed4A126BDA807A7b7498661acD)/[LP Token](https://etherscan.io/address/0x94e131324b6054c0D789b190b2dAC504e4361b53)
USDN | USDT/USDC/DAI/[USDN](https://etherscan.io/address/0x674C6Ad92Fd080e4004b2312b45f796a192D27a0)/[LP Token](https://etherscan.io/address/0x4f3E8F405CF5aFC05D68142F3783bDfE13811522)
sUSD | USDT/USDC/DAI/[sUSD](https://etherscan.io/address/0x57Ab1ec28D129707052df4dF418D58a2D46d5f51)/[LP Token](https://etherscan.io/address/0xC25a3A3b969415c80451098fa907EC722572917F)

# Developer docs
Each DAO Earn pool consist of 3 contracts: **vault**, **strategy**, and **zap**.

**Vault** is the contract to keep and invest LP token.

**Strategy** is the contract to invest and compound LP token in Convex.

**Zap** is the contract to swap token other than LP and deposit into vault.

## Frontend
Example with Ethers.js
### Deposit
LP token: (through **vault** contract)
```
lpToken.approve(vault.address, ethers.constants.MaxUint256)
vault.deposit(amountOfLpToken)
```

USDT/USDC/DAI/Base coin/3Crv: (through **zap** contract)
```
coin.approve(zap.address, ethers.constants.MaxUint256)
zap.deposit(vault.address, amountOfCoin, coin.address)
```

Any available token on Sushi: (through **zap** contract)
```
token.approve(zap.address, ethers.constants.MaxUint256)
zap.depositZap(vault.address, amountOfToken, token.address)
```
To Check token availability, use `checkTokenSwapAvailability()` function in zap contract.
```
zap.checkTokenSwapAvailability(amountInput, tokenInput, tokenOutput)
```

Directly from ETH: (through **zap** contract, `amountOfETH` in 18 decimals)
```
zap.depositZap(vault.address, amountOfETH, ethers.constants.AddressZero, {from: client.address, value: amountOfETH})
```

### Withdraw
LP token: (through **vault** contract)
```
vault.withdraw(amountOfShares)
```
USDT/USDC/DAI/Base coin: (through **zap** contract)
```
zap.withdraw(vault.address, amountOfShares, coin.address)
```

## Backend
[Formula to calculate APY](https://docs.google.com/document/d/1E4xEBG7COtlIvleQWoh26PcvIkpFxgOUpmk9BXJsv8s/edit#heading=h.suss79bdwa4r)