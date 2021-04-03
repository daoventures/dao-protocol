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
Uncomment code in deploy/hardhat/hardhat.js from line 49 to line 68
```
  // const res = await axios.get(
  //   `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_KEY}`
  // );
  // const proposeGasPriceInGwei = ethers.BigNumber.from(
  //   res.data.result.ProposeGasPrice
  // );
  // const proposeGasPrice = proposeGasPriceInGwei.mul("1000000000");

  // const deployer = new ethers.Wallet(process.env.PRIVATE_KEY);
  // const deployerBalance = await ethers.provider.getBalance(deployer.address);

  // console.log(`Total estimated gas used: ${totalGasUsed.toString()}`);
  // console.log(`Current gas price(Etherscan): ${proposeGasPriceInGwei} Gwei`);
  // console.log(
  //   `Total gas fee: ${ethers.utils.formatEther(
  //     totalGasUsed.mul(proposeGasPrice)
  //   )} ETH`
  // );
  // console.log(`Your balance: ${ethers.utils.formatEther(deployerBalance)} ETH`);
  // console.log("Please make sure you have enough ETH before deploy.");
```
Uncomment code in hardhat.config.js from line 15 to 18 and line 24 to line 26
```
    // mainnet: {
    //   url: process.env.ALCHEMY_URL_MAINNET,
    //   accounts: [`0x${process.env.PRIVATE_KEY}`],
    // },
```
```
  // etherscan: {
  //   apiKey: process.env.ETHERSCAN_API_KEY,
  // },
```
Then,
```
npx hardhat deploy --network hardhat --tags hardhat
```
> It will take some time to test deploy on Mainnet fork.

An estimated gas report will print out for reference. Sample report as below:
```
All contracts had deployed successfully on Mainnet fork in block 12049274.
Total estimated gas used: 24064356
Current gas price(Etherscan): 139 Gwei
Total gas fee: 3.344945484 ETH
Your balance: 0.0 ETH
Please make sure you have enough ETH before deploy.
```
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
Sample output:
```
Summary:
Yearn-Farmer USDT v2 address:  0x3Aa5ebB10DC797CAC828524e59A333d0A371443c
DAO Vault Medium USDT address:  0xc6e7DF5E7b4f2A278906862b61205850344D4e7d

Yearn-Farmer USDC v2 address:  0x59b670e9fA9D0A427751Af201D676719a970857b
DAO Vault Medium USDC address:  0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1

Yearn-Farmer DAI v2 address:  0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44
DAO Vault Medium DAI address:  0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f

Yearn-Farmer TUSD v2 address:  0x7a2088a1bFc9d81c55368AE168C2C02570cB814F
DAO Vault Medium TUSD address:  0x09635F643e140090A9A8Dcd712eD6285858ceBef
```