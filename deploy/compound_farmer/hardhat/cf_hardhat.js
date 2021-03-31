const axios = require("axios");
const { ethers } = require("hardhat");
require("dotenv").config();

module.exports = async () => {
  console.log(
    `All contracts had deployed successfully on Mainnet fork in block ${await ethers.provider.getBlockNumber()}.`
  );

  const cfUSDT = await deployments.get("CompoundFarmerUSDT");
  const dvlUSDT = await deployments.get("DAOVaultLowUSDT");
  const cfUSDC = await deployments.get("CompoundFarmerUSDC");
  const dvlUSDC = await deployments.get("DAOVaultLowUSDC");
  const cfDAI = await deployments.get("CompoundFarmerDAI");
  const dvlDAI = await deployments.get("DAOVaultLowDAI");

  let tx, totalGasUsed;
  const cfUSDTContract = await ethers.getContract("CompoundFarmerUSDT");
  tx = await cfUSDTContract.setVault(dvlUSDT.address);
  const cfUSDTContractReceipt = await tx.wait();
  const cfUSDCContract = await ethers.getContract("CompoundFarmerUSDC");
  tx = await cfUSDCContract.setVault(dvlUSDC.address);
  const cfUSDCContractReceipt = await tx.wait();
  const cfDAIContract = await ethers.getContract("CompoundFarmerDAI");
  tx = await cfDAIContract.setVault(dvlDAI.address);
  const cfDAIContractReceipt = await tx.wait();
  const totalCallFunctionGasUsed = cfUSDTContractReceipt.gasUsed
    .add(cfUSDCContractReceipt.gasUsed)
    .add(cfDAIContractReceipt.gasUsed)

  totalGasUsed =
    parseInt(cfDAI.receipt.gasUsed) +
    parseInt(cfUSDC.receipt.gasUsed) +
    parseInt(cfUSDT.receipt.gasUsed) +
    parseInt(dvlDAI.receipt.gasUsed) +
    parseInt(dvlUSDC.receipt.gasUsed) +
    parseInt(dvlUSDT.receipt.gasUsed);
  totalGasUsed = ethers.BigNumber.from(totalGasUsed.toString());
  totalGasUsed = totalGasUsed.add(totalCallFunctionGasUsed);

  // const res = await axios.get(
  //   `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_KEY}`
  // );
  // const proposeGasPriceInGwei = ethers.BigNumber.from(
  //   res.data.result.FastGasPrice
  // );
  // const proposeGasPrice = proposeGasPriceInGwei.mul("1000000000");

  // const deployer = new ethers.Wallet(process.env.PRIVATE_KEY);
  // const deployerBalance = await ethers.provider.getBalance(deployer.address);

  // console.log(`Total estimated gas used: ${totalGasUsed.toString()}`);
  // console.log(`Current gas price(Etherscan): ${proposeGasPriceInGwei} Gwei (fast gas price)`);
  // console.log(
  //   `Total gas fee: ${ethers.utils.formatEther(
  //     totalGasUsed.mul(proposeGasPrice)
  //   )} ETH`
  // );
  // console.log(`Your balance: ${ethers.utils.formatEther(deployerBalance)} ETH`);
  // console.log("Please make sure you have enough ETH before deploy.");
};
module.exports.tags = ["cf_hardhat"];
module.exports.dependencies = [
  "cf_hardhat_reset",
  "cf_hardhat_deploy_USDT",
  "cf_hardhat_deploy_USDC",
  "cf_hardhat_deploy_DAI",
];
