const { ethers, network } = require("hardhat");
const IERC20_ABI = require("../abis/IERC20_ABI.json");

// const hfTokenAddress = "0xf0358e8c3CD5Fa238a29301d0bEa3D63A17bEdBE";
// const hfTokenAddress = "0x053c80eA73Dc6941F518a68E2FC52Ac45BDE7c9C";
const hfTokenAddress = "0xab7FA2B2985BCcfC13c6D86b1D5A17486ab1e04C";
// const hfStakeAddress = "0x4F7c28cCb0F1Dbd1388209C67eEc234273C878Bd";
// const hfStakeAddress = "0x6ac4a7AB91E6fD098E13B7d347c6d4d1494994a2";
const hfStakeAddress = "0x15d3A64B2d5ab9E152F16593Cdebc4bB165B5B4A";
// const unlockedAddress = "0x55FE002aefF02F77364de339a1292923A15844B8";
// const unlockedAddress = "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8";
const unlockedAddress = "0x13aec50f5D3c011cd3fed44e2a30C515Bd8a5a06";
// const tokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
// const tokenAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const tokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const iFARMAddress = "0x1571eD0bed4D987fe2b498DdBaE7DFA19519F651";
const FARMAddress = "0xa0246c9032bC3A600820415aE600c6388619A14D";
const COMPAddress = "0xc00e94Cb662C3520282E6f5717214004A7f26888";
const IDLEAddress = "0x875773784Af8135eA0ef43b5a374AaD105c5D39e";
const governanceAddress = "0xf00dD244228F51547f0563e60bCa65a30FBF5f7f";

const decimals = (amount) => {
//   return ethers.utils.parseUnits(amount.toString(), 6); // Change this to meet token decimals
  return ethers.utils.parseUnits(amount.toString(), 18); // Change this to meet token decimals
};

describe("Harvest-Farmer", () => {
  it("should work", async () => {
    let tx, receipt
    // Transfer token from unlocked account to deployer
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [unlockedAddress],
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governanceAddress],
    });
    const [deployerSigner, _] = await ethers.getSigners();
    const unlockedSigner = await ethers.getSigner(unlockedAddress);
    const governanceSigner = await ethers.getSigner(governanceAddress);
    const tokenContract = new ethers.Contract(
      tokenAddress,
      IERC20_ABI,
      deployerSigner
    );
    // console.log((await tokenContract.balanceOf(unlockedAddress)).toString())
    await tokenContract
      .connect(unlockedSigner)
      .transfer(deployerSigner.address, decimals(100));

    const hfToken_ABI = [
      "function deposit(uint) external",
      "function balanceOf(address) external view returns (uint)",
      "function approve(address, uint) external",
      "function withdraw(uint) external",
      "function rebalance() external",
    ];
    const hfTokenContract = new ethers.Contract(
      hfTokenAddress,
      hfToken_ABI,
      deployerSigner
    );
    await tokenContract.approve(hfTokenContract.address, decimals(100));
    tx = await hfTokenContract.deposit(decimals(100));
    receipt = await tx.wait()
    console.log(receipt.gasUsed.toString())
    const fTokenBalance = await hfTokenContract.balanceOf(
      deployerSigner.address
    );
    await hfTokenContract.connect(governanceSigner).rebalance();
    // await hfTokenContract.withdraw(fTokenBalance)
    // console.log(fTokenBalance.toString())
    const hfStake_ABI = [
      "function stake(uint) external",
      "function getReward() external",
      "function exit() external",
    ];
    const hfStakeContract = new ethers.Contract(
      hfStakeAddress,
      hfStake_ABI,
      deployerSigner
    );
    await hfTokenContract.approve(hfStakeAddress, fTokenBalance);
    tx = await hfStakeContract.stake(fTokenBalance);
    receipt = await tx.wait()
    console.log(receipt.gasUsed.toString())
    // iFARM_ABI = ["function balanceOf(address) external view returns (uint)"]
    // const iFARMContract = new ethers.Contract(iFARMAddress, iFARM_ABI, deployerSigner)
    // console.log((await iFARMContract.balanceOf(deployerSigner.address)).toString())
    // await hfStakeContract.getReward();
    FARM_ABI = ["function balanceOf(address) external view returns (uint)"];
    const FARMContract = new ethers.Contract(
      FARMAddress,
      FARM_ABI,
      deployerSigner
    );
    // console.log((await FARMContract.balanceOf(deployerSigner.address)).toString())
    tx = await hfStakeContract.exit();
    receipt = await tx.wait()
    console.log(receipt.gasUsed.toString())
    // console.log((await FARMContract.balanceOf(deployerSigner.address)).toString())
    // console.log((await hfTokenContract.balanceOf(deployerSigner.address)).toString())
    tx = await hfTokenContract.withdraw(fTokenBalance);
    receipt = await tx.wait()
    console.log(receipt.gasUsed.toString())
    // console.log(
    //   (await tokenContract.balanceOf(deployerSigner.address)).toString()
    // );
    // console.log(
    //   (await FARMContract.balanceOf(deployerSigner.address)).toString()
    // );
    // const COMPContract = new ethers.Contract(COMPAddress, IERC20_ABI, deployerSigner);
    // console.log((await COMPContract.balanceOf(deployerSigner.address)).toString())
    // const IDLEContract = new ethers.Contract(IDLEAddress, IERC20_ABI, deployerSigner);
    // console.log((await IDLEContract.balanceOf(deployerSigner.address)).toString())
  });
});
