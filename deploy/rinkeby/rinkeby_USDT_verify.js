const { ethers, run } = require("hardhat");
const { rinkeby: network_ } = require("../../addresses");

const { tokenAddress, yEarnAddress, yVaultAddress } = network_.USDT;

module.exports = async () => {
  const yfUSDTContract = await ethers.getContract("YearnFarmerUSDTv2");
  await run("verify:verify", {
    address: yfUSDTContract.address,
    constructorArguments: [tokenAddress, yEarnAddress, yVaultAddress],
    contract: "contracts/YearnFarmerUSDTv2.sol:YearnFarmerUSDTv2",
  });

  const dvmUSDTContract = await ethers.getContract("DAOVaultMediumUSDT");
  await run("verify:verify", {
    address: dvmUSDTContract.address,
    constructorArguments: [tokenAddress, yfUSDTContract.address],
    contract: "contracts/DAOVaultMediumUSDT.sol:DAOVaultMediumUSDT",
  });
};
module.exports.tags = ["rinkeby_USDT_verify"];
