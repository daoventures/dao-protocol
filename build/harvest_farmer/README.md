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
Uncomment code in hardhat.config.js from line 16 to 19 and line 29 to line 31
```
    // mainnet: {
    //   url: process.env.ALCHEMY_URL_MAINNET,
    //   accounts: [`0x${process.env.PRIVATE_KEY}`],
    // },
```
```
  // etherscan: {
  //   apiKey: process.env.ETHERSCAN_API_KEY
  // },
```
Then,
```
npx hardhat deploy --network hardhat --tags hf_hardhat
```
> It will take some time to test deploy on Mainnet fork.

> Because of the different deployment method from previous, total gas fees are not able to calculate automatically anymore. Please uncomment ```Calculate total gas used``` section in ```hf_hardhat_deploy_factory.js``` and all ```hf_hardhat_deploy_<token>.js``` and add the total gas fees manually.

## Deployment - 2 approaches
### 1. one-command all contracts deployment + Etherscan verification
```
npx hardhat deploy --network mainnet --tags hf_mainnet --export ./build/deployments.js
```
> It will create a ```deployment.js``` in build folder after complete deployment. ```deployment.js``` contains abis for frontend development, but not the addresses for Vault and Strategy(the addresses in ```deployment.js``` is for factory and template contracts). Please use print deployed addresses method below for Vault and Strategy contracts address.

### 2. Manually deploy each contract and verify on Etherscan
#### Deploy contracts
```
npx hardhat deploy --network mainnet --tags hf_mainnet_deploy_factory
npx hardhat deploy --network mainnet --tags hf_mainnet_deploy_DAI
npx hardhat deploy --network mainnet --tags hf_mainnet_deploy_USDC
npx hardhat deploy --network mainnet --tags hf_mainnet_deploy_USDT
```
> Because now factory-clone method used to deploy contracts, the deployment sequence is crucial to prevent any error.

#### Verify on Etherscan
```
npx hardhat deploy --network mainnet --tags hf_mainnet_verify_factory
```
> In factory-clone deployment, only factory contracts need verified, all other token specific cloned Vault and Strategy contracts will copy verified code from factory contracts.

## Print out deployed contracts
```
npx hardhat run --network mainnet scripts/harvest_farmer/addresses.js
```
Sample output:
```
Summary contracts for Harvest Farmer:
DAOVault Medium-Risk DAI address:  0xF6Cd30117E16FEacAeBD2BD30A6d682af6FB9844

DAOVault Medium-Risk USDC address:  0xefD426cee17809039c84Da8E37951C634901E427

DAOVault Medium-Risk USDT address:  0xb0f92a610E83602bf5dF258265dbE1561AE33e85

*Strategy addresses can be found in DAOVault strategy()

DAOVault factory address:  0xe617e3472B0D7Fc846B4091d7892B604FFbDE61B

HarvestFarmer factory address:  0xa6174e047882A3c38Fd910dA64ed95D9Df9A98Ab

DAOVault template address:  0x230F34C380a8E77b98ed46f468c2e4e151F1bC94

HarvestFarmer template address:  0xc54690C17Db13B9C663EAAd867AE3881d9396A55
```

# Changelog (from Compound-Farmer)

1. Deployment methods as above. In pratical, we deploy the factory contracts 1st. Factory contracts consist of 4 contracts: vault factory contract, vault template contract, strategy factory contract and strategy template contract. When we want to deploy a new vault or strategy, we actually just call the createVault()/createStrategy() function which utilize the clone() function from OpenZeppelin, by passing the necessary arguments like token contract address.

2. Network fees are implemented in Vault contract. Deposit amount will be deducted and send to treasury/community wallet before send to strategy contract. This is because ERC20 interaction between Vault and Strategy had been removed to save user gas fee for deposit/withdraw/refund, and also able to reuse this contract after migrate funds. Downside is whenever there is a need to change treasury/community wallet, admin had to change treasury/community wallet for both Vault and Strategy contracts.

3. With the removal of ERC20 interaction between Vault and Strategy, it is possible to reuse this contract. Please only reuse this contract if the new strategy after this strategy have issue and replace strategy has not ready yet. All functions working normally in Mainnet fork after reuse this contract except cannot earn FARM token.