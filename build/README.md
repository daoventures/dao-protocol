# Procedure to Mainnet deployment
## Create an .env file
```
ALCHEMY_URL_MAINNET=<YOUR_ALCHEMY_MAINNET_URL_HERE>
PRIVATE_KEY=<YOUR_PRIVATE_KEY_HERE>
ETHERSCAN_API_KEY=<YOUR_ETHERSCAN_API_KEY_HERE>

```
> Recommended to use Alchemy public node instead of Infura to prevent some weird error. Register an Etherscan account for free for their API key for contract verification.
## Compile
```
npx hardhat compile
```
## Test deploy on local hardhat network
```
npx hardhat deploy --network hardhat --tags hardhat
```
> It will take some time because it fork Mainnet and test deploy in Mainnet fork.
## Deployment - 2 approaches
### 1. one-command all contracts deployment + Etherscan verification
```
npx hardhat deploy --network mainnet --tags mainnet --export ./build/deployments.js
```
> It will create a deployment.js in build folder after complete deployment. deployment.js contains all contracts addresses and abis for frontend development.
### 2. Manually deploy each contract and verify on Etherscan
#### Deploy contracts
```
npx hardhat deploy --network mainnet --tags mainnet_<token>_deploy
```
#### Verify on Etherscan
```
npx hardhat deploy --network mainnet --tags mainnet_<token>_verify
```
> \<token> include USDT, USDC, DAI and TUSD
## Print out deployed contracts
```
npx hardhat run --network mainnet scripts/addresses.js
```