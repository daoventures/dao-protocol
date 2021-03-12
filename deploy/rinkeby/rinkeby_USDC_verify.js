const { ethers, run } = require("hardhat");
const { rinkeby: network_ } = require("../../addresses");

const { tokenAddress, yEarnAddress, yVaultAddress } = network_.USDC;

module.exports = async () => {
  const yfUSDCContract = await ethers.getContract("YearnFarmerUSDCv2");
  await run("verify:verify", {
    address: yfUSDCContract.address,
    constructorArguments: [tokenAddress, yEarnAddress, yVaultAddress],
    contract: "contracts/YearnFarmerUSDCv2.sol:YearnFarmerUSDCv2",
  });

  const dvmUSDCContract = await ethers.getContract("DAOVaultMediumUSDC");
  await run("verify:verify", {
    address: dvmUSDCContract.address,
    constructorArguments: [tokenAddress, yfUSDCContract.address],
    contract: "contracts/DAOVaultMediumUSDC.sol:DAOVaultMediumUSDC",
  });
};
module.exports.tags = ["rinkeby_USDC_verify"];
