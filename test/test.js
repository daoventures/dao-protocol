const { ethers, network } = require("hardhat")
const { expect } = require("chai")
const IERC20_ABI = require("../abis/IERC20_ABI.json")

const USDTAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const DAIAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const WETHAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
// const unlockedAddress = "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE"
const unlockedAddress = "0x28C6c06298d514Db089934071355E5743bf21d60" // Start from block 12613000

describe("DAO Cuban's Ape Strategy", () => {
    it("should work", async () => {
        let tx, receipt
        const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
        const CubanApeStrategy = await ethers.getContractFactory("CubanApeStrategy", deployer)
        const cubanApeStrategy = await CubanApeStrategy.deploy([1500, 1500, 1400, 1400, 1400, 1400, 1400])
        // receipt = await cubanApeStrategy.deployTransaction.wait()
        // console.log(receipt.gasUsed.toString())
        const CubanApeVault = await ethers.getContractFactory("CubanApeVault", deployer)
        const cubanApeVault = await CubanApeVault.deploy(
            cubanApeStrategy.address, treasury.address, community.address, admin.address, strategist.address, biconomy.address
        )
        // receipt = await cubanApeVault.deployTransaction.wait()
        // console.log(receipt.gasUsed.toString())
        await cubanApeStrategy.setVault(cubanApeVault.address)
        await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
        const unlockedSigner = await ethers.getSigner(unlockedAddress);
        const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, deployer);
        const USDCContract = new ethers.Contract(USDCAddress, IERC20_ABI, deployer);
        const DAIContract = new ethers.Contract(DAIAddress, IERC20_ABI, deployer);
        const WETH_ABI = [
            "function deposit() external payable",
            "function withdraw(uint) external",
            "function transfer(address, uint) external",
            "function balanceOf(address) external view returns (uint)"
        ]
        const WETHContract = new ethers.Contract(WETHAddress, WETH_ABI, deployer);
        await USDTContract.connect(unlockedSigner).transfer(client.address, ethers.utils.parseUnits("2000", 6))
        await USDCContract.connect(unlockedSigner).transfer(client.address, ethers.utils.parseUnits("2000", 6))
        await DAIContract.connect(unlockedSigner).transfer(client.address, ethers.utils.parseUnits("2000", 18))
        await USDTContract.connect(client).approve(cubanApeVault.address, ethers.constants.MaxUint256)
        await USDCContract.connect(client).approve(cubanApeVault.address, ethers.constants.MaxUint256)
        await DAIContract.connect(client).approve(cubanApeVault.address, ethers.constants.MaxUint256)

        tx = await cubanApeVault.connect(client).deposit(ethers.utils.parseUnits("1000", 6), 0)
        // receipt = await tx.wait()
        // console.log("Deposit gas used:", receipt.gasUsed.toString())
        // console.log(ethers.utils.formatEther(await cubanApeVault.balanceOf(deployer.address)))
        tx = await cubanApeVault.connect(client).deposit(ethers.utils.parseUnits("1000", 6), 1)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        // console.log(ethers.utils.formatEther(await cubanApeVault.balanceOf(deployer.address)))
        tx = await cubanApeVault.connect(client).deposit(ethers.utils.parseUnits("1000", 18), 2)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        // console.log(ethers.utils.formatEther(await cubanApeVault.balanceOf(deployer.address)))

        // Invest
        tx = await cubanApeVault.connect(admin).invest()
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())

        // Adjust farm composition
        // await cubanApeVault.connect(admin).setWeights([0, 5000, 5000]) // 17653.304222 591.395586 17644.360807
        // await cubanApeVault.connect(admin).setWeights([5000, 0, 5000]) // 17860.447166 594.659875 17721.860743
        // await cubanApeVault.connect(admin).setWeights([5000, 5000, 0]) // 17653.304222 591.395586 17644.360807
        // await cubanApeVault.connect(admin).setWeights([3333, 3333, 3334]) // 17750.838935 593.037147 17671.770961

        // Second deposit and invest
        await cubanApeVault.connect(client).deposit(ethers.utils.parseUnits("1000", 6), 0)
        await cubanApeVault.connect(client).deposit(ethers.utils.parseUnits("1000", 6), 1)
        await cubanApeVault.connect(client).deposit(ethers.utils.parseUnits("1000", 18), 2)
        await cubanApeVault.connect(admin).invest()

        // // Fees
        // console.log((await USDTContract.balanceOf(treasury.address)).toString()) // 240.000000
        // console.log((await USDTContract.balanceOf(community.address)).toString()) // 240.000000
        // console.log((await USDTContract.balanceOf(strategist.address)).toString()) // 120.000000

        // // Balance keep in vault
        // console.log((await USDTContract.balanceOf(cubanApeVault.address)).toString()) // 1200.000000
        // console.log((await USDCContract.balanceOf(cubanApeVault.address)).toString()) // 1200.000000
        // console.log((await DAIContract.balanceOf(cubanApeVault.address)).toString()) // 1200.000000
        
        // // Swap token within vault
        // await cubanApeVault.connect(admin).swapTokenWithinVault(0, 2, ethers.utils.parseUnits("1000", 6))
        // console.log((await USDTContract.balanceOf(cubanApeVault.address)).toString())
        // console.log((await USDCContract.balanceOf(cubanApeVault.address)).toString())
        // console.log((await DAIContract.balanceOf(cubanApeVault.address)).toString())

        // // Reimburse from strategy
        // await cubanApeVault.connect(admin).retrieveStablecoinsFromStrategy(0, 0, ethers.utils.parseUnits("1000", 6))
        // await cubanApeVault.connect(admin).retrieveStablecoinsFromStrategy(1, 1, ethers.utils.parseUnits("1000", 6))
        // await cubanApeVault.connect(admin).retrieveStablecoinsFromStrategy(2, 2, ethers.utils.parseUnits("1000", 18))
        // await cubanApeVault.connect(admin).retrieveStablecoinsFromStrategy(0, 3, ethers.utils.parseUnits("1000", 6))
        // await cubanApeVault.connect(admin).retrieveStablecoinsFromStrategy(1, 4, ethers.utils.parseUnits("1000", 6))
        // await cubanApeVault.connect(admin).retrieveStablecoinsFromStrategy(2, 5, ethers.utils.parseUnits("1000", 18))
        // await cubanApeVault.connect(admin).retrieveStablecoinsFromStrategy(0, 6, ethers.utils.parseUnits("1000", 6))
        // console.log((await USDTContract.balanceOf(cubanApeVault.address)).toString()) // 4168.983336
        // console.log((await USDCContract.balanceOf(cubanApeVault.address)).toString()) // 3174.996881
        // console.log((await DAIContract.balanceOf(cubanApeVault.address)).toString()) // 3174.981319645054260269

        // // Emergency withdraw
        // const sTSLAContract = new ethers.Contract(sTSLAAddress, IERC20_ABI, deployer);
        // const WBTCContract = new ethers.Contract(WBTCAddress, IERC20_ABI, deployer);
        // const renDOGEContract = new ethers.Contract(renDOGEAddress, IERC20_ABI, deployer);
        // console.log((await sTSLAContract.balanceOf(cubanApeStrategy.address)).toString()) // 31.532144491556754685
        // console.log((await WBTCContract.balanceOf(cubanApeStrategy.address)).toString()) // 0.49574763
        // console.log((await renDOGEContract.balanceOf(cubanApeStrategy.address)).toString()) // 47628.68050231
        // console.log((await WETHContract.balanceOf(cubanApeStrategy.address)).toString()) // 0
        // await cubanApeVault.connect(admin).emergencyWithdraw()
        // console.log((await sTSLAContract.balanceOf(cubanApeStrategy.address)).toString()) // 0
        // console.log((await WBTCContract.balanceOf(cubanApeStrategy.address)).toString()) // 0
        // console.log((await renDOGEContract.balanceOf(cubanApeStrategy.address)).toString()) // 0
        // console.log((await WETHContract.balanceOf(cubanApeStrategy.address)).toString()) // 20.386927355945763094
        // await cubanApeVault.connect(admin).reinvest()
        // console.log((await sTSLAContract.balanceOf(cubanApeStrategy.address)).toString()) // 31.220995478658847410
        // console.log((await WBTCContract.balanceOf(cubanApeStrategy.address)).toString()) // 0.49210180
        // console.log((await renDOGEContract.balanceOf(cubanApeStrategy.address)).toString()) // 47468.34963855
        // console.log((await WETHContract.balanceOf(cubanApeStrategy.address)).toString()) // 0

        // // Assume profit for strategy
        // await WETHContract.deposit({value: ethers.utils.parseEther("1")})
        // await WETHContract.transfer(cubanApeStrategy.address, ethers.utils.parseEther("1"))

        // Withdraw
        const withdrawSharesSmall = (await cubanApeVault.balanceOf(client.address)).mul(1).div(100)
        const withdrawShares = (await cubanApeVault.balanceOf(client.address)).mul(30).div(100)
        // console.log((await cubanApeVault.balanceOf(client.address)).toString())
        // console.log(withdrawShares.toString()) // 8910.000000000000000000
        tx = await cubanApeVault.connect(client).withdraw(withdrawShares, 0);
        // receipt = await tx.wait()
        // console.log("Deposit gas used:", receipt.gasUsed.toString())
        tx = await cubanApeVault.connect(client).withdraw(withdrawSharesSmall, 1);
        // receipt = await tx.wait()
        // console.log("Deposit gas used:", receipt.gasUsed.toString())
        tx = await cubanApeVault.connect(client).withdraw(withdrawShares, 2);
        // receipt = await tx.wait()
        // console.log("Deposit gas used:", receipt.gasUsed.toString())
        // tx = await cubanApeVault.connect(client).withdraw(withdrawShares, 2);
        // tx = await cubanApeVault.connect(client).withdraw(withdrawShares, 0);
        console.log("Withdraw amount for USDT", ethers.utils.formatUnits(await USDTContract.balanceOf(client.address), 6)) // 1762.426931
        console.log("Withdraw amount for USDC", ethers.utils.formatUnits(await USDCContract.balanceOf(client.address), 6)) // 59.067676
        console.log("Withdraw amount for DAI", ethers.utils.formatUnits(await DAIContract.balanceOf(client.address), 18)) // 1760.912359708617692581

        // // Withdraw after emergency withdraw
        // const withdrawShares = (await cubanApeVault.balanceOf(client.address)).mul(30).div(100)
        // await cubanApeVault.connect(admin).emergencyWithdraw()
        // // console.log("After emergency witdraw");
        // tx = await cubanApeVault.connect(client).withdraw(withdrawShares, 0);
        // tx = await cubanApeVault.connect(client).withdraw(withdrawShares, 1);
        // tx = await cubanApeVault.connect(client).withdraw(withdrawShares, 2);
        // console.log("Withdraw amount for USDT", ethers.utils.formatUnits(await USDTContract.balanceOf(client.address), 6))
        // console.log("Withdraw amount for USDC", ethers.utils.formatUnits(await USDCContract.balanceOf(client.address), 6))
        // console.log("Withdraw amount for DAI", ethers.utils.formatUnits(await DAIContract.balanceOf(client.address), 18))

        // // Migrate funds
        // const CubanApeStrategy2 = await ethers.getContractFactory("CubanApeStrategy", deployer)
        // const cubanApeStrategy2 = await CubanApeStrategy2.deploy([1500, 1500, 1400, 1400, 1400, 1400, 1400])
        // await cubanApeStrategy2.setVault(cubanApeVault.address)
        // await cubanApeVault.setPendingStrategy(cubanApeStrategy2.address)
        // await cubanApeVault.connect(admin).emergencyWithdraw()
        // await cubanApeVault.unlockMigrateFunds()
        // network.provider.send("evm_increaseTime", [86400*2])
        // await cubanApeStrategy.approveMigrate()
        // // console.log((await WETHContract.balanceOf(cubanApeStrategy.address)).toString())
        // await cubanApeVault.migrateFunds()
        // expect(await WETHContract.balanceOf(cubanApeStrategy.address)).to.equal(0)
        // // console.log((await WETHContract.balanceOf(cubanApeStrategy2.address)).toString())
        // await cubanApeVault.connect(admin).reinvest()
        // expect(await WETHContract.balanceOf(cubanApeStrategy.address)).to.equal(0)
        // await cubanApeVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 0)
        // await cubanApeVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 1)
        // await cubanApeVault.connect(client).deposit(ethers.utils.parseUnits("10000", 18), 2)
        // await cubanApeVault.connect(admin).invest()
        // expect(await cubanApeVault.strategy()).to.equal(cubanApeStrategy2.address)

        // // Admin functions
        // await cubanApeVault.connect(admin).setWeights([1000, 1000, 8000])
        // console.log((await cubanApeStrategy.weights(0)).toString())
        // console.log((await cubanApeStrategy.weights(1)).toString())
        // console.log((await cubanApeStrategy.weights(2)).toString())
        // await cubanApeVault.connect(admin).setPercTokenKeepInVault([300, 300, 300])
        // console.log(((await cubanApeVault.tokens(0))[2]).toString())
        // console.log(((await cubanApeVault.tokens(1))[2]).toString())
        // console.log(((await cubanApeVault.tokens(2))[2]).toString())
        // await cubanApeVault.setNetworkFeeTier2([1000000000, 5000000000])
        // console.log((await cubanApeVault.networkFeeTier2(0)).toString())
        // console.log((await cubanApeVault.networkFeeTier2(1)).toString())
        // await cubanApeVault.setCustomNetworkFeeTier(100000000000)
        // console.log((await cubanApeVault.customNetworkFeeTier()).toString())
        // await cubanApeVault.setNetworkFeePerc([200, 100, 75])
        // console.log((await cubanApeVault.networkFeePerc(0)).toString())
        // console.log((await cubanApeVault.networkFeePerc(1)).toString())
        // console.log((await cubanApeVault.networkFeePerc(2)).toString())
        // await cubanApeVault.setCustomNetworkFeePerc(50)
        // console.log((await cubanApeVault.customNetworkFeePerc()).toString())
        // await cubanApeVault.setProfitSharingFeePerc(2500);
        // console.log((await cubanApeVault.profitSharingFeePerc()).toString())
        // await cubanApeVault.setTreasuryWallet("0xb1AD074E17AD59f2103A8832DADE917388D6C50D")
        // console.log(await cubanApeVault.treasuryWallet())
        // await cubanApeVault.setCommunityWallet("0xb1AD074E17AD59f2103A8832DADE917388D6C50D")
        // console.log(await cubanApeVault.communityWallet())
        // await cubanApeVault.setBiconomy("0xb1AD074E17AD59f2103A8832DADE917388D6C50D")
        // console.log(await cubanApeVault.trustedForwarder())
        // await cubanApeVault.setAdmin("0xb1AD074E17AD59f2103A8832DADE917388D6C50D")
        // console.log(await cubanApeVault.admin())
        // await cubanApeVault.connect(strategist).setStrategist("0xb1AD074E17AD59f2103A8832DADE917388D6C50D")
        // console.log(await cubanApeVault.strategist())
    })

    // it("should work in Kovan", async () => {
    //     const deployerAddress = "0xb1AD074E17AD59f2103A8832DADE917388D6C50D"
    //     const treasuryAddress = "0x59E83877bD248cBFe392dbB5A8a29959bcb48592"
    //     const communityAddress = "0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0"
    //     const adminAddress = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
    //     const strategistAddress = "0x54D003d451c973AD7693F825D5b78Adfc0efe934"
    //     const biconomyAddress = "0xF82986F574803dfFd9609BE8b9c7B92f63a1410E"
    //     await network.provider.request({method: "hardhat_impersonateAccount",params: [deployerAddress],});
    //     const deployer = await ethers.getSigner(deployerAddress)
    //     const CubanApeStrategy = await ethers.getContractFactory("CubanApeStrategyKovan", deployer)
    //     const cubanApeStrategy = await CubanApeStrategy.deploy([1500, 1500, 1400, 1400, 1400, 1400, 1400])
    //     const CubanApeVault = await ethers.getContractFactory("CubanApeVaultKovan", deployer)
    //     const cubanApeVault = await CubanApeVault.deploy(
    //         cubanApeStrategy.address,
    //         treasuryAddress,
    //         communityAddress,
    //         adminAddress,
    //         strategistAddress,
    //         biconomyAddress
    //     )
    //     await cubanApeStrategy.setVault(cubanApeVault.address)
    //     await network.provider.request({method: "hardhat_impersonateAccount",params: [adminAddress],});
    //     const admin = await ethers.getSigner(adminAddress);
    //     const USDTContract = new ethers.Contract("0x07de306FF27a2B630B1141956844eB1552B956B5", IERC20_ABI, deployer);
    //     await USDTContract.approve(cubanApeVault.address, ethers.constants.MaxUint256)
    //     await cubanApeVault.deposit(ethers.utils.parseUnits("1000", 6), 0)
    //     tx = await cubanApeVault.connect(admin).invest()
    //     await cubanApeVault.withdraw((await cubanApeVault.balanceOf(deployer.address)).mul(1).div(2), 0)
    // })
})