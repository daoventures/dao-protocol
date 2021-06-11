const axios = require("axios");
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  let tx, receipt, totalGasUsed
  const [deployer] = await ethers.getSigners()
  const ElonApeStrategy = await ethers.getContractFactory(
    'ElonApeStrategy',
    deployer,
  )
  const elonApeStrategy = await ElonApeStrategy.deploy([3333, 3333, 3333])
  receipt = await elonApeStrategy.deployTransaction.wait()
  totalGasUsed = new ethers.BigNumber.from(receipt.gasUsed.toString())

  const ElonApeVault = await ethers.getContractFactory('ElonApeVault', deployer)
  const elonApeVault = await ElonApeVault.deploy(
    elonApeStrategy.address,
    '0x59E83877bD248cBFe392dbB5A8a29959bcb48592', // Treasury wallet
    '0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0', // Community wallet
    '0x3f68A3c1023d736D8Be867CA49Cb18c543373B99', // Admin
    '0x54D003d451c973AD7693F825D5b78Adfc0efe934', // Strategist
    '0x84a0856b038eaAd1cC7E297cF34A7e72685A8693', // Biconomy
  )
  receipt = await elonApeVault.deployTransaction.wait()
  totalGasUsed = totalGasUsed.add(receipt.gasUsed.toString())

  tx = await elonApeStrategy.setVault(elonApeVault.address)
  receipt = await tx.wait()
  totalGasUsed = totalGasUsed.add(receipt.gasUsed.toString())

  const res = await axios.get(`https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_KEY}`);
  const proposeGasPriceInGwei = ethers.BigNumber.from(res.data.result.ProposeGasPrice); // Can choose between SafeGasPrice, ProposeGasPrice and FastGasPrice
  const proposeGasPrice = proposeGasPriceInGwei.mul("1000000000");
  const deployerMainnet = new ethers.Wallet(process.env.PRIVATE_KEY);
  const deployerBalance = await ethers.provider.getBalance(deployerMainnet.address);

  console.log("Estimated gas used:", totalGasUsed.toString())
  console.log(`Estimated gas price(Etherscan): ${proposeGasPriceInGwei} Gwei`)
  console.log(`Estimated deployment fee: ${ethers.utils.formatEther(totalGasUsed.mul(proposeGasPrice))} ETH`)
  console.log(`Your balance: ${ethers.utils.formatEther(deployerBalance)} ETH`);
  console.log("Please make sure you have enough ETH before deploy.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
