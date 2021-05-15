const { ethers, network } = require("hardhat")
const { expect } = require("chai")
const IERC20_ABI = require("../abis/IERC20_ABI.json")

const USDTAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const DAIAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const WETHAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const unlockedAddress = "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE"
const CRVAddress = "0xD533a949740bb3306d119CC777fa900bA034cd52"
const PICKLEAddress = "0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5"
const SUSHIAddress = "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2"
const treasuryWallet = "0x59E83877bD248cBFe392dbB5A8a29959bcb48592"
const communityWallet = "0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0"

describe("DAO Citadel Strategy", () => {
    it("should work", async () => {
        let tx, receipt
        const [deployer] = await ethers.getSigners()
        const CitadelStrategy = await ethers.getContractFactory("CitadelStrategy", deployer)
        const citadelStrategy = await CitadelStrategy.deploy(treasuryWallet, communityWallet, deployer.address)
        const CitadelVault = await ethers.getContractFactory("CitadelVault", deployer)
        const citadelVault = await CitadelVault.deploy(citadelStrategy.address, deployer.address, deployer.address)
        await citadelStrategy.setVault(citadelVault.address)
        await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
        const unlockedSigner = await ethers.getSigner(unlockedAddress);
        const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, deployer);
        const USDCContract = new ethers.Contract(USDCAddress, IERC20_ABI, deployer);
        const DAIContract = new ethers.Contract(DAIAddress, IERC20_ABI, deployer);
        await USDTContract.connect(unlockedSigner).transfer(deployer.address, ethers.utils.parseUnits("30000", 6))
        await USDCContract.connect(unlockedSigner).transfer(deployer.address, ethers.utils.parseUnits("20000", 6))
        await DAIContract.connect(unlockedSigner).transfer(deployer.address, ethers.utils.parseUnits("20000", 18))
        const WETH_ABI = [
            "function deposit() external payable",
            "function withdraw(uint) external",
            "function transfer(address, uint) external",
            "function balanceOf(address) external view returns (uint)"
        ]
        const WETHContract = new ethers.Contract(WETHAddress, WETH_ABI, deployer);
        await USDTContract.approve(citadelVault.address, ethers.constants.MaxUint256)
        await USDCContract.approve(citadelVault.address, ethers.constants.MaxUint256)
        await DAIContract.approve(citadelVault.address, ethers.constants.MaxUint256)
        await citadelVault.deposit(ethers.utils.parseUnits("10000", 6), 0)
        // console.log(ethers.utils.formatEther(await citadelVault.balanceOf(deployer.address)))
        await citadelVault.deposit(ethers.utils.parseUnits("10000", 6), 0)
        // console.log(ethers.utils.formatEther(await citadelVault.balanceOf(deployer.address)))
        await citadelVault.deposit(ethers.utils.parseUnits("10000", 6), 0)
        // console.log(ethers.utils.formatEther(await citadelVault.balanceOf(deployer.address)))
        tx = await citadelVault.invest()
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(citadelVault.address), 6))
        const withdrawShares = (await citadelVault.balanceOf(deployer.address)).mul(1).div(100)
        tx = await citadelVault.withdraw(withdrawShares, 0);
        receipt = await tx.wait()
        console.log(receipt.gasUsed.toString())
        // await citadelVault.withdraw(citadelVault.balanceOf(deployer.address));
        console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(deployer.address), 6))

        // await citadelStrategy._updatePoolForPriceChange()
        // console.log(ethers.utils.formatUnits(await citadelVault.getAllPoolInUSD(), 6))
        // expect(await citadelVault.getAllPoolInUSD()).to.equal("29804237726")

        // const CRVContract = new ethers.Contract(CRVAddress, IERC20_ABI, unlockedSigner)
        // await CRVContract.transfer(citadelStrategy.address, ethers.utils.parseEther("1"))
        // const unlockedAddress2 = "0xAee0394C675727560F78457D5fCA518b4cDD6CD9"
        // await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress2],});
        // const unlockedSigner2 = await ethers.getSigner(unlockedAddress2);
        // const PICKLEContract = new ethers.Contract(PICKLEAddress, IERC20_ABI, unlockedSigner2)
        // await PICKLEContract.transfer(citadelStrategy.address, ethers.utils.parseEther("1"))
        // const SUSHIContract = new ethers.Contract(SUSHIAddress, IERC20_ABI, unlockedSigner)
        // await SUSHIContract.transfer(citadelStrategy.address, ethers.utils.parseEther("1"))

        // await citadelVault.deposit(ethers.utils.parseUnits("10000", 6), 0)
        // await citadelVault.deposit(ethers.utils.parseUnits("10000", 6), 1)
        // await citadelVault.deposit(ethers.utils.parseUnits("10000", 18), 2)

        // tx = await citadelVault.invest()
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        // console.log(ethers.utils.formatUnits(await citadelVault.getAllPoolInUSD(), 6))

        // // Check percentage increase
        // const DENOMINATOR = new ethers.BigNumber.from("10000")
        // const after = new ethers.BigNumber.from("7302950597687545278")
        // const before = new ethers.BigNumber.from("7238025508872954873")
        // const percIncrease = after.mul(DENOMINATOR).div(before)
        // console.log(percIncrease.toString())
    })
})