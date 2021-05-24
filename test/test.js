const { ethers, network } = require("hardhat")
const { expect } = require("chai")
const IERC20_ABI = require("../abis/IERC20_ABI.json")
const sampleContract_JSON = require("../build/Citadel/SampleContract.json")

const USDTAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const DAIAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const WETHAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const unlockedAddress = "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE"
const CRVAddress = "0xD533a949740bb3306d119CC777fa900bA034cd52"
const PICKLEAddress = "0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5"
const SUSHIAddress = "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2"
const cStakeAddress = "0x4c18E409Dc8619bFb6a1cB56D114C3f592E0aE79"
const pStakeWBTCAddress = "0xD55331E7bCE14709d825557E5Bca75C73ad89bFb"
const sStakeAddress = "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd"
const pStakeDAIAddress = "0x6092c7084821057060ce2030F9CC11B22605955F"

describe("DAO Citadel Strategy", () => {
    it("should work", async () => {
        let tx, receipt
        // Deploy contracts
        const [deployer, admin, strategist, treasury, community] = await ethers.getSigners()
        const CitadelStrategy = await ethers.getContractFactory("CitadelStrategy", deployer)
        const citadelStrategy = await CitadelStrategy.deploy(treasury.address, community.address, deployer.address)
        const CitadelVault = await ethers.getContractFactory("CitadelVault", deployer)
        const citadelVault = await CitadelVault.deploy(
            citadelStrategy.address, treasury.address, community.address, admin.address, strategist.address, deployer.address
        )
        await citadelStrategy.setVault(citadelVault.address)

        // Transfer some stablecoins from impersonate account
        await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
        const unlockedSigner = await ethers.getSigner(unlockedAddress);
        const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, deployer);
        const USDCContract = new ethers.Contract(USDCAddress, IERC20_ABI, deployer);
        const DAIContract = new ethers.Contract(DAIAddress, IERC20_ABI, deployer);
        const WETHContract = new ethers.Contract(WETHAddress, IERC20_ABI, deployer);
        await USDTContract.connect(unlockedSigner).transfer(deployer.address, ethers.utils.parseUnits("10000", 6))
        await USDCContract.connect(unlockedSigner).transfer(deployer.address, ethers.utils.parseUnits("10000", 6))
        await DAIContract.connect(unlockedSigner).transfer(deployer.address, ethers.utils.parseUnits("10000", 18))

        // Deposit stablecoins into vault
        await USDTContract.approve(citadelVault.address, ethers.constants.MaxUint256)
        await USDCContract.approve(citadelVault.address, ethers.constants.MaxUint256)
        await DAIContract.approve(citadelVault.address, ethers.constants.MaxUint256)
        const sampleContract = await waffle.deployContract(deployer, sampleContract_JSON, [citadelVault.address, USDTContract.address])
        await expect(sampleContract.deposit("10000000000", 2)).to.be.revertedWith("Only EOA or biconomy")
        const sampleBiconomyContract = await waffle.deployContract(deployer, sampleContract_JSON, [citadelVault.address, USDTContract.address])
        await citadelVault.setBiconomy(sampleBiconomyContract.address)
        await expect(sampleBiconomyContract.deposit("10000000000", 2)).not.to.be.revertedWith("Only EOA or biconomy")
        await expect(citadelVault.deposit("0", 0)).to.be.revertedWith("Amount must > 0")
        await citadelVault.deposit(ethers.utils.parseUnits("10000", 18), 2)
        expect(await DAIContract.balanceOf(deployer.address)).to.equal("0")
        const ChainLink_ABI = ["function latestAnswer() external view returns (int256)"]
        const chainLinkContract = new ethers.Contract("0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46", ChainLink_ABI, deployer) // USDT/ETH
        const ETHPrice = await chainLinkContract.latestAnswer()
        const expectedLPToken = (new ethers.BigNumber.from("9900")).mul(ETHPrice)
        expect(await citadelVault.balanceOf(deployer.address)).to.equal(expectedLPToken)
        expect(await DAIContract.balanceOf(citadelVault.address)).to.equal(ethers.utils.parseEther("10000"))

        // Invest into strategy
        await citadelVault.deposit(ethers.utils.parseUnits("10000", 6), 0)
        await citadelVault.deposit(ethers.utils.parseUnits("10000", 6), 1)
        await expect(citadelVault.invest()).to.be.revertedWith("Only admin")
        const fees = 10000 * 3 * (1 / 100)
        tx = await citadelVault.connect(admin).invest()
        receipt = await tx.wait()
        console.log(receipt.gasUsed.toString())
        expect(await USDTContract.balanceOf(treasury.address)).to.equal(ethers.utils.parseUnits((fees * 4 / 10).toString(), 6))
        expect(await USDTContract.balanceOf(community.address)).to.equal(ethers.utils.parseUnits((fees * 4 / 10).toString(), 6))
        expect(await USDTContract.balanceOf(strategist.address)).to.equal(ethers.utils.parseUnits((fees * 2 / 10).toString(), 6))
        const keepInVault = 29700 * 2 / 100
        expect(await USDTContract.balanceOf(citadelVault.address)).to.be.closeTo(ethers.utils.parseUnits(keepInVault.toString(), 6), ethers.utils.parseUnits("1", 6))
        expect(await USDCContract.balanceOf(citadelVault.address)).to.be.closeTo(ethers.utils.parseUnits(keepInVault.toString(), 6), ethers.utils.parseUnits("1", 6))
        expect(await DAIContract.balanceOf(citadelVault.address)).to.be.closeTo(ethers.utils.parseUnits(keepInVault.toString(), 18), ethers.utils.parseUnits("1", 18))
        const gauge_ABI = ["function balanceOf(address _address) external view returns (uint256)"]
        const cStakeContract = new ethers.Contract(cStakeAddress, gauge_ABI, deployer)
        const pStakeWBTCContract = new ethers.Contract(pStakeWBTCAddress, gauge_ABI, deployer)
        const pStakeDAIContract = new ethers.Contract(pStakeDAIAddress, gauge_ABI, deployer)
        const masterChef_ABI = ["function userInfo(uint256, address) external returns(uint256, uint256)"]
        const sStakeContract = new ethers.Contract(sStakeAddress, masterChef_ABI, deployer)

        // const chainLinkContract2 = new ethers.Contract("0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", ChainLink_ABI, deployer) // ETH/USD
        // const USDPrice = await chainLinkContract2.latestAnswer()
        // console.log(USDPrice.toString()) // 4117.73040722
        // console.log()
        // uint256[] memory amounts = router.getAmountsOut(_amount, _getPath(address(WETH), address(USDT)));
        // console.log(amounts[1]);
    })

    it("should work", async () => {
        // let tx, receipt
        // const [deployer, admin, strategist, biconomy] = await ethers.getSigners()
        // const CitadelStrategy = await ethers.getContractFactory("CitadelStrategy", deployer)
        // const citadelStrategy = await CitadelStrategy.deploy(treasuryWallet, communityWallet, deployer.address)
        // const CitadelVault = await ethers.getContractFactory("CitadelVault", deployer)
        // const citadelVault = await CitadelVault.deploy(
        //     citadelStrategy.address, treasuryWallet, communityWallet, admin.address, strategist.address, biconomy.address
        // )
        // await citadelStrategy.setVault(citadelVault.address)
        // await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
        // const unlockedSigner = await ethers.getSigner(unlockedAddress);
        // const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, deployer);
        // const USDCContract = new ethers.Contract(USDCAddress, IERC20_ABI, deployer);
        // const DAIContract = new ethers.Contract(DAIAddress, IERC20_ABI, deployer);
        // await USDTContract.connect(unlockedSigner).transfer(deployer.address, ethers.utils.parseUnits("10000", 6))
        // await USDCContract.connect(unlockedSigner).transfer(deployer.address, ethers.utils.parseUnits("10000", 6))
        // await DAIContract.connect(unlockedSigner).transfer(deployer.address, ethers.utils.parseUnits("10000", 18))
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
        // tx = await citadelVault.deposit(ethers.utils.parseUnits("10000", 6), 0)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        // console.log(ethers.utils.formatEther(await citadelVault.balanceOf(deployer.address)))
        // tx = await citadelVault.deposit(ethers.utils.parseUnits("10000", 6), 1)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        // console.log(ethers.utils.formatEther(await citadelVault.balanceOf(deployer.address)))
        // tx = await citadelVault.deposit(ethers.utils.parseUnits("10000", 18), 2)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        // console.log(ethers.utils.formatEther(await citadelVault.balanceOf(deployer.address)))

        // // Invest
        // tx = await citadelVault.connect(admin).invest()

        // // Withdraw
        // const withdrawShares = (await citadelVault.balanceOf(deployer.address)).mul(30).div(100)
        // tx = await citadelVault.withdraw(withdrawShares, 0);
        // tx = await citadelVault.withdraw(withdrawShares, 1);
        // tx = await citadelVault.withdraw(withdrawShares, 2);
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(deployer.address), 6))
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(deployer.address), 6))
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(deployer.address), 18))

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

        // // Swap token within vault
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(citadelVault.address), 6))
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(citadelVault.address), 18))
        // await citadelVault.swapTokenWithinVault(0, 2)
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(citadelVault.address), 6))
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(citadelVault.address), 18))
    })
})