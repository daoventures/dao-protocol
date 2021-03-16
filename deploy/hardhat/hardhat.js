const axios = require("axios");
const { ethers } = require("hardhat");
require("dotenv").config();

module.exports = async ({ deployments }) => {
  console.log(
    `All contracts had deployed successfully on Mainnet fork in block ${await ethers.provider.getBlockNumber()}.`
  );

  const yfUSDT = await deployments.get("YearnFarmerUSDTv2");
  const dvmUSDT = await deployments.get("DAOVaultMediumUSDT");
  const yfUSDC = await deployments.get("YearnFarmerUSDCv2");
  const dvmUSDC = await deployments.get("DAOVaultMediumUSDC");
  const yfDAI = await deployments.get("YearnFarmerDAIv2");
  const dvmDAI = await deployments.get("DAOVaultMediumDAI");
  const yfTUSD = await deployments.get("YearnFarmerTUSDv2");
  const dvmTUSD = await deployments.get("DAOVaultMediumTUSD");

  let tx, totalGasUsed;
  const yfUSDTContract = await ethers.getContract("YearnFarmerUSDTv2");
  tx = await yfUSDTContract.setVault(dvmUSDT.address);
  const yfUSDTContractReceipt = await tx.wait();
  const yfUSDCContract = await ethers.getContract("YearnFarmerUSDCv2");
  tx = await yfUSDCContract.setVault(dvmUSDC.address);
  const yfUSDCContractReceipt = await tx.wait();
  const yfDAIContract = await ethers.getContract("YearnFarmerDAIv2");
  tx = await yfDAIContract.setVault(dvmDAI.address);
  const yfDAIContractReceipt = await tx.wait();
  const yfTUSDContract = await ethers.getContract("YearnFarmerTUSDv2");
  tx = await yfTUSDContract.setVault(dvmTUSD.address);
  const yfTUSDContractReceipt = await tx.wait();
  const totalCallFunctionGasUsed = yfUSDTContractReceipt.gasUsed
    .add(yfUSDCContractReceipt.gasUsed)
    .add(yfDAIContractReceipt.gasUsed)
    .add(yfTUSDContractReceipt.gasUsed);

  totalGasUsed =
    parseInt(yfDAI.receipt.gasUsed) +
    parseInt(yfTUSD.receipt.gasUsed) +
    parseInt(yfUSDC.receipt.gasUsed) +
    parseInt(yfUSDT.receipt.gasUsed) +
    parseInt(dvmDAI.receipt.gasUsed) +
    parseInt(dvmTUSD.receipt.gasUsed) +
    parseInt(dvmUSDC.receipt.gasUsed) +
    parseInt(dvmUSDT.receipt.gasUsed);
  totalGasUsed = ethers.BigNumber.from(totalGasUsed.toString());
  totalGasUsed = totalGasUsed.add(totalCallFunctionGasUsed);

  const res = await axios.get(
    `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_KEY}`
  );
  const proposeGasPriceInGwei = ethers.BigNumber.from(
    res.data.result.ProposeGasPrice
  );
  const proposeGasPrice = proposeGasPriceInGwei.mul("1000000000");

  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY);
  const deployerBalance = await ethers.provider.getBalance(deployer.address);

  console.log(`Total estimated gas used: ${totalGasUsed.toString()}`);
  console.log(`Current gas price(Etherscan): ${proposeGasPriceInGwei} Gwei`);
  console.log(
    `Total gas fee: ${ethers.utils.formatEther(
      totalGasUsed.mul(proposeGasPrice)
    )} ETH`
  );
  console.log(`Your balance: ${ethers.utils.formatEther(deployerBalance)} ETH`);
  console.log("Please make sure you have enough ETH before deploy.");
};
module.exports.tags = ["hardhat"];
module.exports.dependencies = [
  // "hardhat_reset",
  "hardhat_USDT",
  "hardhat_USDC",
  "hardhat_DAI",
  "hardhat_TUSD",
];
