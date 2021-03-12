const { mainnet } = require("../addresses");

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();
  const cfUSDT = await deploy("CompoundFarmerUSDT", {
    from: deployer.address,
    args: [
      mainnet.USDTAddress,
      mainnet.cTokenAddress,
      mainnet.compTokenAddress,
      mainnet.comptrollerAddress,
      mainnet.uniswapRouterAddress,
      mainnet.WETHAddress,
    ],
  });
  const dvlUSDT = await deploy("DAOVaultLowUSDT", {
    from: deployer.address,
    args: [mainnet.USDTAddress, cfUSDT.address],
  });

  const cfUSDTContract = await ethers.getContract("CompoundFarmerUSDT");
  await cfUSDTContract.setVault(dvlUSDT.address);
};
