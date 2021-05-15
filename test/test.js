const { ethers, network } = require("hardhat")
const IERC20_ABI = require("../abis/IERC20_ABI.json")

const USDTAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const DAIAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const WETHAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const unlockedAddress = "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE"

describe("DAO Citadel Strategy", () => {
    it("should work", async () => {
        // let tx, receipt
        // const [deployer] = await ethers.getSigners()
        // const CitadelStrategy = await ethers.getContractFactory("CitadelStrategy", deployer)
        // const citadelStrategy = await CitadelStrategy.deploy(deployer.address)
        // const CitadelVault = await ethers.getContractFactory("CitadelVault", deployer)
        // const citadelVault = await CitadelVault.deploy(citadelStrategy.address, deployer.address, deployer.address)
        // await citadelStrategy.setVault(citadelVault.address)
        // await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
        // const unlockedSigner = await ethers.getSigner(unlockedAddress);
        // const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, deployer);
        // const USDCContract = new ethers.Contract(USDCAddress, IERC20_ABI, deployer);
        // const DAIContract = new ethers.Contract(DAIAddress, IERC20_ABI, deployer);
        // await USDTContract.connect(unlockedSigner).transfer(deployer.address, ethers.utils.parseUnits("30000", 6))
        // await USDCContract.connect(unlockedSigner).transfer(deployer.address, ethers.utils.parseUnits("20000", 6))
        // await DAIContract.connect(unlockedSigner).transfer(deployer.address, ethers.utils.parseUnits("20000", 18))
        // const WETH_ABI = [
        //     "function deposit() external payable",
        //     "function withdraw(uint) external",
        //     "function transfer(address, uint) external",
        //     "function balanceOf(address) external view returns (uint)"
        // ]
        // const WETHContract = new ethers.Contract(WETHAddress, WETH_ABI, deployer);
        // await USDTContract.approve(citadelVault.address, ethers.constants.MaxUint256)
        // await USDCContract.approve(citadelVault.address, ethers.constants.MaxUint256)
        // await DAIContract.approve(citadelVault.address, ethers.constants.MaxUint256)
        // await citadelVault.deposit(ethers.utils.parseUnits("10000", 6), 0)
        // await citadelVault.deposit(ethers.utils.parseUnits("10000", 6), 1)
        // await citadelVault.deposit(ethers.utils.parseUnits("10000", 18), 2)
        // await citadelVault.invest()
        // console.log(ethers.utils.formatUnits(await citadelVault.getAllTVLInUSD(), 6)) // 29804.237726

        // const usdtAmt = ethers.utils.parseUnits("1000", 6)
        const ethAmt = ethers.utils.parseEther("1")
        const usdtPrice = new ethers.BigNumber.from("403762678911")
        console.log((ethAmt.mul(usdtPrice)).toString())
    })
})