const { ethers, run } = require("hardhat");
const { rinkeby: network_ } = require("../../addresses");

const { tokenAddress, yEarnAddress, yVaultAddress } = network_.DAI;

module.exports = async () => {
  const yfDAIContract = await ethers.getContract("YearnFarmerDAIv2");
  await run("verify:verify", {
    address: yfDAIContract.address,
    constructorArguments: [tokenAddress, yEarnAddress, yVaultAddress],
    contract: "contracts/YearnFarmerDAIv2.sol:YearnFarmerDAIv2",
  });

  const dvmDAIContract = await ethers.getContract("DAOVaultMediumDAI");
  await run("verify:verify", {
    address: dvmDAIContract.address,
    constructorArguments: [tokenAddress, yfDAIContract.address],
    contract: "contracts/DAOVaultMediumDAI.sol:DAOVaultMediumDAI",
  });
};
module.exports.tags = ["rinkeby_DAI_verify"];
