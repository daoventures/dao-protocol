# Harvest-Farmer
Harvest-Farmer is a lending aggregator that build on top of Harvest Finance.

### The smart contract is still under development (testing and auditing) and we strongly advise anyone not to deposit anything on the mainnet until we publicly launch the product.

## Installation
Clone the repository and install it.
```
git clone https://github.com/daoventures/dao-protocol
cd dao-protocol
git checkout develop/HarvestFarmer
npm install
```

## Compile
Create an .env file within the folder. Type in `ALCHEMY_URL_MAINNET=https://eth-mainnet.alchemyapi.io/v2/{your-alchemy-id}`
> Note: For public node, we recommend use Alchemy instead of Infura. Infura may cause some weird error in this test suite. If you don't have one, apply in https://www.alchemyapi.io/.
```
npx hardhat compile
```

## Deploy
```
npx hardhat deploy --tags hardhat
```
> Note: First deploy will take some time.

## Tests
```
npx hardhat test
```
> Note: For the first few test run, you may encounter this error `Error: Timeout of 20000ms exceeded.`. If so, please run again `npx hardhat test`. If error still occurred, please run test manually for each file, for example `npx hardhat test test/testUSDT.js`.

## Functions
### User functions

### Admin functions

### General functions daoVault address

# Vault
Vault is a contract that help user to deposit, withdraw and refund in the latest strategy. Vault distribute daoToken to user based on shares.

### The smart contract is still under development (testing and auditing) and we strongly advise anyone not to deposit anything on the mainnet until we publicly launch the product.

> **Installation**, **Compile** and **Tests** is same as Yearn-Farmer v2 section, and it only need to implement 1 time.

## Functions
### User functions

### Admin functions

### General functions