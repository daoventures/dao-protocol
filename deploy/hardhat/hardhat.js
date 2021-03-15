const axios = require("axios")
const { ethers } = require("hardhat")
require("dotenv").config()

module.exports = async ({deployments}) => {
  console.log("All contracts had deployed successfully on Mainnet fork.")

  const yfUSDTContract = await deployments.get("YearnFarmerUSDTv2");
  const dvmUSDTContract = await deployments.get("DAOVaultMediumUSDT");
  const yfUSDCContract = await deployments.get("YearnFarmerUSDCv2");
  const dvmUSDCContract = await deployments.get("DAOVaultMediumUSDC");
  const yfDAIContract = await deployments.get("YearnFarmerDAIv2");
  const dvmDAIContract = await deployments.get("DAOVaultMediumDAI");
  const yfTUSDContract = await deployments.get("YearnFarmerTUSDv2");
  const dvmTUSDContract = await deployments.get("DAOVaultMediumTUSD");

  let totalGasUsed = parseInt(yfDAIContract.receipt.gasUsed) +
    parseInt(yfTUSDContract.receipt.gasUsed) +
    parseInt(yfUSDCContract.receipt.gasUsed) +
    parseInt(yfUSDTContract.receipt.gasUsed) +
    parseInt(dvmDAIContract.receipt.gasUsed) +
    parseInt(dvmTUSDContract.receipt.gasUsed) +
    parseInt(dvmUSDCContract.receipt.gasUsed) +
    parseInt(dvmUSDTContract.receipt.gasUsed)
  totalGasUsed = ethers.BigNumber.from(totalGasUsed.toString())

  const res = await axios.get(`https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_KEY}`)
  const proposeGasPriceInGwei = ethers.BigNumber.from(res.data.result.ProposeGasPrice)
  const proposeGasPrice = proposeGasPriceInGwei.mul("1000000000")

  const [deployer] = await ethers.getSigners()
  const deployerBalance = await ethers.provider.getBalance(deployer.address)

  console.log(`Total estimated gas used: ${totalGasUsed.toString()}`)
  console.log(`Current gas price(Etherscan): ${proposeGasPriceInGwei} Gwei`)
  console.log(`Total gas fee: ${ethers.utils.formatEther(totalGasUsed.mul(proposeGasPrice))} ETH`)
  console.log(`Your balance: ${ethers.utils.formatEther(deployerBalance)} ETH`)
  console.log("Please make sure you have enough ETH before deploy.")
  
};
module.exports.tags = ["hardhat"];
module.exports.dependencies = [
  // "hardhat_reset",
  "hardhat_USDT",
  "hardhat_USDC",
  "hardhat_DAI",
  "hardhat_TUSD",
];
