# dao-protocol

### The smart contract is still under development (testing and auditing) and we strongly advise anyone not to deposit anything on the mainnet until we publicly launch the product.

## Documentation for vaults and strategies
DAOVaultMedium: https://github.com/daoventures/dao-protocol/blob/master/docs/DAOVaultMedium.md

Yearn-Farmer-V2: https://github.com/daoventures/dao-protocol/blob/master/docs/Yearn-Farmer-V2.md

DAOVaultLow: https://github.com/daoventures/dao-protocol/blob/master/docs/DAOVaultLow.md

Compound-Farmer: https://github.com/daoventures/dao-protocol/blob/master/docs/Compound-Farmer.md

## Installation
Clone the repository and install it.
```
git clone https://github.com/daoventures/dao-protocol
cd dao-protocol
npm install
```

## Compile
Create an .env file within the folder. Type in `ALCHEMY_URL_MAINNET=https://eth-mainnet.alchemyapi.io/v2/{your-alchemy-id}`
> Note: For public node, we recommend use Alchemy instead of Infura. Infura may cause some weird error in this test suite. If you don't have one, apply in https://www.alchemyapi.io/.
```
npx hardhat compile
```

## Tests
```
npx hardhat test/<strategy-name>/<test-script>
```
where
<\strategy-name> refer to strategy name in test folder
<\test-script> refer to the script file name contain in strategy name in test folder
> Note: For the first few test run, you may encounter this error `Error: Timeout of 20000ms exceeded.`. If so, please run again `npx hardhat test`.
