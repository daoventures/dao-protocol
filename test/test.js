const { ethers, network } = require("hardhat")
const { expect } = require("chai")
const IERC20_ABI = require("../abis/IERC20_ABI.json")

const USDTAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const DAIAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const WETHAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
// const unlockedAddress = "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE"
const unlockedAddress = "0x28C6c06298d514Db089934071355E5743bf21d60" // Start from block 12613000
const sTSLAAddress = "0x918dA91Ccbc32B7a6A0cc4eCd5987bbab6E31e6D"
const WBTCAddress = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
const renDOGEAddress = "0x3832d2F059E55934220881F831bE501D180671A7"

describe("DAO ElonApe Strategy", () => {
    it("should work", async () => {
        let tx, receipt
        const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
        const ElonApeStrategy = await ethers.getContractFactory("ElonApeStrategy", deployer)
        const elonApeStrategy = await ElonApeStrategy.deploy([3333, 3333, 3334])
        // receipt = await elonApeStrategy.deployTransaction.wait()
        // console.log(receipt.gasUsed.toString())
        const ElonApeVault = await ethers.getContractFactory("ElonApeVault", deployer)
        const elonApeVault = await ElonApeVault.deploy(
            elonApeStrategy.address, treasury.address, community.address, admin.address, strategist.address, biconomy.address
        )
        // receipt = await elonApeVault.deployTransaction.wait()
        // console.log(receipt.gasUsed.toString())
        await elonApeStrategy.setVault(elonApeVault.address)
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
        await USDTContract.connect(unlockedSigner).transfer(client.address, ethers.utils.parseUnits("1000", 6))
        await USDCContract.connect(unlockedSigner).transfer(client.address, ethers.utils.parseUnits("1000", 6))
        await DAIContract.connect(unlockedSigner).transfer(client.address, ethers.utils.parseUnits("1000", 18))
        await USDTContract.connect(client).approve(elonApeVault.address, ethers.constants.MaxUint256)
        await USDCContract.connect(client).approve(elonApeVault.address, ethers.constants.MaxUint256)
        await DAIContract.connect(client).approve(elonApeVault.address, ethers.constants.MaxUint256)

        tx = await elonApeVault.connect(client).deposit(ethers.utils.parseUnits("1000", 6), 0)
        // receipt = await tx.wait()
        // console.log("Deposit gas used:", receipt.gasUsed.toString())
        // console.log(ethers.utils.formatEther(await elonApeVault.balanceOf(deployer.address)))
        tx = await elonApeVault.connect(client).deposit(ethers.utils.parseUnits("1000", 6), 1)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        // console.log(ethers.utils.formatEther(await elonApeVault.balanceOf(deployer.address)))
        tx = await elonApeVault.connect(client).deposit(ethers.utils.parseUnits("1000", 18), 2)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        // console.log(ethers.utils.formatEther(await elonApeVault.balanceOf(deployer.address)))

        // Invest
        tx = await elonApeVault.connect(admin).invest()
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())

        // Adjust farm composition
        // await elonApeVault.connect(admin).setWeights([0, 5000, 5000]) // 17653.304222 591.395586 17644.360807
        // await elonApeVault.connect(admin).setWeights([5000, 0, 5000]) // 17860.447166 594.659875 17721.860743
        // await elonApeVault.connect(admin).setWeights([5000, 5000, 0]) // 17653.304222 591.395586 17644.360807
        // await elonApeVault.connect(admin).setWeights([3333, 3333, 3334]) // 17750.838935 593.037147 17671.770961

        // // Second deposit and invest
        // await elonApeVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 0)
        // await elonApeVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 1)
        // await elonApeVault.connect(client).deposit(ethers.utils.parseUnits("10000", 18), 2)
        // await elonApeVault.connect(admin).invest()

        // // Fees
        // console.log((await USDTContract.balanceOf(treasury.address)).toString()) // 240.000000
        // console.log((await USDTContract.balanceOf(community.address)).toString()) // 240.000000
        // console.log((await USDTContract.balanceOf(strategist.address)).toString()) // 120.000000

        // // Balance keep in vault
        // console.log((await USDTContract.balanceOf(elonApeVault.address)).toString()) // 1200.000000
        // console.log((await USDCContract.balanceOf(elonApeVault.address)).toString()) // 1200.000000
        // console.log((await DAIContract.balanceOf(elonApeVault.address)).toString()) // 1200.000000
        
        // Swap token within vault
        // await elonApeVault.connect(admin).swapTokenWithinVault(0, 2, ethers.utils.parseUnits("1000", 6))
        // console.log((await USDTContract.balanceOf(elonApeVault.address)).toString())
        // console.log((await USDCContract.balanceOf(elonApeVault.address)).toString())
        // console.log((await DAIContract.balanceOf(elonApeVault.address)).toString())

        // // Reimburse from strategy
        // await elonApeVault.connect(admin).retrieveStablecoinsFromStrategy(0, 0, ethers.utils.parseUnits("1000", 6))
        // await elonApeVault.connect(admin).retrieveStablecoinsFromStrategy(1, 1, ethers.utils.parseUnits("1000", 6))
        // await elonApeVault.connect(admin).retrieveStablecoinsFromStrategy(2, 2, ethers.utils.parseUnits("1000", 6))
        // console.log((await USDTContract.balanceOf(elonApeVault.address)).toString()) // 2189.617752
        // console.log((await USDCContract.balanceOf(elonApeVault.address)).toString()) // 2181.644174
        // console.log((await DAIContract.balanceOf(elonApeVault.address)).toString()) // 2181.636392549914289639

        // // Emergency withdraw
        // const sTSLAContract = new ethers.Contract(sTSLAAddress, IERC20_ABI, deployer);
        // const WBTCContract = new ethers.Contract(WBTCAddress, IERC20_ABI, deployer);
        // const renDOGEContract = new ethers.Contract(renDOGEAddress, IERC20_ABI, deployer);
        // console.log((await sTSLAContract.balanceOf(elonApeStrategy.address)).toString()) // 31.532144491556754685
        // console.log((await WBTCContract.balanceOf(elonApeStrategy.address)).toString()) // 0.49574763
        // console.log((await renDOGEContract.balanceOf(elonApeStrategy.address)).toString()) // 47628.68050231
        // console.log((await WETHContract.balanceOf(elonApeStrategy.address)).toString()) // 0
        // await elonApeVault.connect(admin).emergencyWithdraw()
        // console.log((await sTSLAContract.balanceOf(elonApeStrategy.address)).toString()) // 0
        // console.log((await WBTCContract.balanceOf(elonApeStrategy.address)).toString()) // 0
        // console.log((await renDOGEContract.balanceOf(elonApeStrategy.address)).toString()) // 0
        // console.log((await WETHContract.balanceOf(elonApeStrategy.address)).toString()) // 20.386927355945763094
        // await elonApeVault.connect(admin).reinvest()
        // console.log((await sTSLAContract.balanceOf(elonApeStrategy.address)).toString()) // 31.220995478658847410
        // console.log((await WBTCContract.balanceOf(elonApeStrategy.address)).toString()) // 0.49210180
        // console.log((await renDOGEContract.balanceOf(elonApeStrategy.address)).toString()) // 47468.34963855
        // console.log((await WETHContract.balanceOf(elonApeStrategy.address)).toString()) // 0

        // // Assume profit for strategy
        // await WETHContract.deposit({value: ethers.utils.parseEther("1")})
        // await WETHContract.transfer(elonApeStrategy.address, ethers.utils.parseEther("1"))

        // Withdraw
        const withdrawSharesSmall = (await elonApeVault.balanceOf(client.address)).mul(1).div(100)
        const withdrawShares = (await elonApeVault.balanceOf(client.address)).mul(30).div(100)
        // console.log((await elonApeVault.balanceOf(client.address)).toString())
        // console.log(withdrawShares.toString()) // 8910.000000000000000000
        tx = await elonApeVault.connect(client).withdraw(withdrawShares, 0);
        // receipt = await tx.wait()
        // console.log("Deposit gas used:", receipt.gasUsed.toString())
        tx = await elonApeVault.connect(client).withdraw(withdrawSharesSmall, 1);
        // receipt = await tx.wait()
        // console.log("Deposit gas used:", receipt.gasUsed.toString())
        tx = await elonApeVault.connect(client).withdraw(withdrawShares, 2);
        // receipt = await tx.wait()
        // console.log("Deposit gas used:", receipt.gasUsed.toString())
        // tx = await elonApeVault.connect(client).withdraw(withdrawShares, 2);
        // tx = await elonApeVault.connect(client).withdraw(withdrawShares, 0);
        console.log("Withdraw amount for USDT", ethers.utils.formatUnits(await USDTContract.balanceOf(client.address), 6))
        // 17750.838935 17691.886347 8983.718529   18075.42949      892.593042
        console.log("Withdraw amount for USDC", ethers.utils.formatUnits(await USDCContract.balanceOf(client.address), 6))
        // 593.037147 594.0 298.761189             599.807932       892.818327(29.769212)
        console.log("Withdraw amount for DAI", ethers.utils.formatUnits(await DAIContract.balanceOf(client.address), 18))
        // 17671.770961 17700.38353 8920.39671     17853.339412     890.855899

        // // Withdraw after emergency withdraw
        // const withdrawShares = (await elonApeVault.balanceOf(client.address)).mul(30).div(100)
        // await elonApeVault.connect(admin).emergencyWithdraw()
        // // console.log("After emergency witdraw");
        // tx = await elonApeVault.connect(client).withdraw(withdrawShares, 0);
        // tx = await elonApeVault.connect(client).withdraw(withdrawShares, 1);
        // tx = await elonApeVault.connect(client).withdraw(withdrawShares, 2);
        // console.log("Withdraw amount for USDT", ethers.utils.formatUnits(await USDTContract.balanceOf(client.address), 6))
        // console.log("Withdraw amount for USDC", ethers.utils.formatUnits(await USDCContract.balanceOf(client.address), 6))
        // console.log("Withdraw amount for DAI", ethers.utils.formatUnits(await DAIContract.balanceOf(client.address), 18))

        // // Migrate funds
        // const ElonApeStrategy2 = await ethers.getContractFactory("ElonApeStrategy", deployer)
        // const elonApeStrategy2 = await ElonApeStrategy2.deploy([3333, 3333, 3334])
        // await elonApeStrategy2.setVault(elonApeVault.address)
        // await elonApeVault.setPendingStrategy(elonApeStrategy2.address)
        // await elonApeVault.connect(admin).emergencyWithdraw()
        // await elonApeVault.unlockMigrateFunds()
        // network.provider.send("evm_increaseTime", [86400*2])
        // await elonApeStrategy.approveMigrate()
        // console.log((await WETHContract.balanceOf(elonApeStrategy.address)).toString())
        // await elonApeVault.migrateFunds()
        // expect(await WETHContract.balanceOf(elonApeStrategy.address)).to.equal(0)
        // console.log((await WETHContract.balanceOf(elonApeStrategy2.address)).toString())
        // await elonApeVault.connect(admin).reinvest()
        // expect(await WETHContract.balanceOf(elonApeStrategy.address)).to.equal(0)
        // await elonApeVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 0)
        // await elonApeVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 1)
        // await elonApeVault.connect(client).deposit(ethers.utils.parseUnits("10000", 18), 2)
        // await elonApeVault.connect(admin).invest()
        // expect(await elonApeVault.strategy()).to.equal(elonApeStrategy2.address)

        // // Admin functions
        // await elonApeVault.connect(admin).setWeights([1000, 1000, 8000])
        // console.log((await elonApeStrategy.weights(0)).toString())
        // console.log((await elonApeStrategy.weights(1)).toString())
        // console.log((await elonApeStrategy.weights(2)).toString())
        // await elonApeVault.connect(admin).setPercTokenKeepInVault([300, 300, 300])
        // console.log(((await elonApeVault.tokens(0))[2]).toString())
        // console.log(((await elonApeVault.tokens(1))[2]).toString())
        // console.log(((await elonApeVault.tokens(2))[2]).toString())
        // await elonApeVault.setNetworkFeeTier2([1000000000, 5000000000])
        // console.log((await elonApeVault.networkFeeTier2(0)).toString())
        // console.log((await elonApeVault.networkFeeTier2(1)).toString())
        // await elonApeVault.setCustomNetworkFeeTier(100000000000)
        // console.log((await elonApeVault.customNetworkFeeTier()).toString())
        // await elonApeVault.setNetworkFeePerc([200, 100, 75])
        // console.log((await elonApeVault.networkFeePerc(0)).toString())
        // console.log((await elonApeVault.networkFeePerc(1)).toString())
        // console.log((await elonApeVault.networkFeePerc(2)).toString())
        // await elonApeVault.setCustomNetworkFeePerc(50)
        // console.log((await elonApeVault.customNetworkFeePerc()).toString())
        // await elonApeVault.setProfitSharingFeePerc(2500);
        // console.log((await elonApeVault.profitSharingFeePerc()).toString())
        // await elonApeVault.setTreasuryWallet("0xb1AD074E17AD59f2103A8832DADE917388D6C50D")
        // console.log(await elonApeVault.treasuryWallet())
        // await elonApeVault.setCommunityWallet("0xb1AD074E17AD59f2103A8832DADE917388D6C50D")
        // console.log(await elonApeVault.communityWallet())
        // await elonApeVault.setBiconomy("0xb1AD074E17AD59f2103A8832DADE917388D6C50D")
        // console.log(await elonApeVault.trustedForwarder())
        // await elonApeVault.setAdmin("0xb1AD074E17AD59f2103A8832DADE917388D6C50D")
        // console.log(await elonApeVault.admin())
        // await elonApeVault.connect(strategist).setStrategist("0xb1AD074E17AD59f2103A8832DADE917388D6C50D")
        // console.log(await elonApeVault.strategist())
    })
})