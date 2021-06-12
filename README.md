# Deployment
## Deploy on Hardhat mainnet fork (and show estimated gas fees)
```
npx hardhat run scripts/deployHardhat.js
```
## Deploy on Kovan
```
npx hardhat run --network kovan scripts/deployKovan.js
```
### Verify on Etherscan
Copy the output in terminal from above deployment, and paste in verifyKovan.js
```
const vaultAddress = "" // copy from deployKovan.js output
const strategyAddress = "" // copy from deployKovan.js output
```
Then run
```
npx hardhat run --network kovan scripts/verifyKovan.js
```
## Deploy on Mainnet
```
npx hardhat run --network mainnet scripts/deployMainnet.js
```
### Verify on Etherscan
Copy the output in terminal from above deployment, and paste in verifyMainnet.js
```
const vaultAddress = "" // copy from deployMainnet.js output
const strategyAddress = "" // copy from deployMainnet.js output
```
Then run
```
npx hardhat run --network mainnet scripts/verifyMainnet.js
```
