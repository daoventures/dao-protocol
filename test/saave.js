const { ethers, upgrades, network } = require("hardhat")
const { expect } = require("chai")
const IERC20_ABI = require("../abis/IERC20_ABI.json")

const DAIAddr = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const sUSDAddr = "0x57Ab1ec28D129707052df4dF418D58a2D46d5f51"
const aDAIAddr = "0x028171bCA77440897B824Ca71D1c56caC55b68A3"
const aSUSDAddr = "0x6C5024Cd4F8A59110119C56f8933403A539555EB"
const AXSAddr = "0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b"
const lpTokenAddr = "0x02d341CcB60fAaf662bC0554d13778015d1b285C" // *variable
const unlockedAddr = "0x28C6c06298d514Db089934071355E5743bf21d60"
const unlockedLpTokenAddr = "0xE594173Aaa1493665EC6A19a0D170C76EEa1124a" // *variable
const unlockedaDAIAddr = "0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296"
const unlockedaSUSDAddr = "0xEd90aB9f302505f903ed36EcF6E3401D96db4328"

const curvePoolAddr = "0xEB16Ae0052ed37f479f7fe63849198Df1765a733" // *variable

const poolIndex = 26 // *variable
const curveZapType = "CurveLendingPool2Zap" // *variable

describe("DAO Earn", () => {
    it("should work", async () => {
        let tx, receipt
        const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
        const CurveZap = await ethers.getContractFactory(curveZapType, deployer)
        const curveZap = await CurveZap.deploy()
        const EarnStrategyTemplate = await ethers.getContractFactory("EarnStrategyAAVE", deployer)
        const earnStrategyTemplate = await EarnStrategyTemplate.deploy()
        const EarnStrategyFactory = await ethers.getContractFactory("EarnStrategyFactory", deployer)
        const earnStrategyFactory = await EarnStrategyFactory.deploy()
        await earnStrategyFactory.createStrategy(
            earnStrategyTemplate.address,
            poolIndex, curveZap.address,
            admin.address, community.address, strategist.address
        )
        const earnStrategyAddr = await earnStrategyFactory.strategies((await earnStrategyFactory.getTotalStrategies()).sub(1))
        const earnStrategy = await ethers.getContractAt("EarnStrategy", earnStrategyAddr, deployer)
        const EarnVault = await ethers.getContractFactory("EarnVault", deployer)
        const earnVault = await upgrades.deployProxy(EarnVault, [
            await earnStrategy.lpToken(), earnStrategyAddr, curveZap.address,
            treasury.address, community.address,
            admin.address, strategist.address, biconomy.address
        ])
        await earnVault.deployed()
        await earnStrategy.setVault(earnVault.address)
        await curveZap.addPool(earnVault.address, curvePoolAddr, ethers.constants.AddressZero)
        // Transfer LP token to client
        await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedLpTokenAddr],});
        const unlockedLpTokenSigner = await ethers.getSigner(unlockedLpTokenAddr);
        const lpTokenContract = new ethers.Contract(lpTokenAddr, IERC20_ABI, unlockedLpTokenSigner);
        await lpTokenContract.transfer(client.address, ethers.utils.parseEther("20000"))
        await lpTokenContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
        // Transfer DAI/sUSD coin to client
        await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddr],});
        const unlockedSigner = await ethers.getSigner(unlockedAddr);
        const DAIContract = new ethers.Contract(DAIAddr, IERC20_ABI, unlockedSigner)
        const sUSDContract = new ethers.Contract(sUSDAddr, IERC20_ABI, unlockedSigner)
        const AXSContract = new ethers.Contract(AXSAddr, IERC20_ABI, unlockedSigner)
        await DAIContract.transfer(client.address, ethers.utils.parseEther("20000"))
        await sUSDContract.transfer(client.address, ethers.utils.parseEther("20000"))
        await AXSContract.transfer(client.address, ethers.utils.parseEther("20000"))
        await DAIContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        await sUSDContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        await AXSContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        // Transfer aDAI/aSUSD coin to client
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedaDAIAddr],});
        const unlockedaDAISigner = await ethers.getSigner(unlockedaDAIAddr);
        const aDAIContract = new ethers.Contract(aDAIAddr, IERC20_ABI, unlockedaDAISigner)
        await aDAIContract.transfer(client.address, ethers.utils.parseEther("20000"))
        await aDAIContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedaSUSDAddr],});
        const unlockedaSUSDSigner = await ethers.getSigner(unlockedaSUSDAddr);
        const aSUSDContract = new ethers.Contract(aSUSDAddr, IERC20_ABI, unlockedaSUSDSigner)
        await aSUSDContract.transfer(client.address, ethers.utils.parseEther("20000"))
        await aSUSDContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)

        // Deposit
        tx = await earnVault.connect(client).deposit(ethers.utils.parseEther("10000"))
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        // console.log(ethers.utils.formatEther(await earnVault.getAmtToInvest()))
        // console.log("Client share in USD:", ethers.utils.formatUnits((await earnVault.balanceOf(client.address)).mul(await earnVault.getPricePerFullShare(true)), 24))
        // console.log(ethers.utils.formatUnits(await earnVault.getPricePerFullShare(true), 6))
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), DAIAddr)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), sUSDAddr)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())

        // Invest
        tx = await earnVault.connect(admin).invest()
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())

        // Second deposit and invest, check fees
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), aDAIAddr)
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), aSUSDAddr)
        tx = await curveZap.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("750"), AXSAddr)
        tx = await curveZap.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("5"), ethers.constants.AddressZero, {from: client.address, value: ethers.utils.parseEther("5")})
        // console.log(ethers.utils.formatEther(await DAIContract.balanceOf(treasury.address)))
        // console.log(ethers.utils.formatEther(await DAIContract.balanceOf(community.address)))
        // console.log(ethers.utils.formatEther(await DAIContract.balanceOf(strategist.address)))
        // await earnVault.connect(admin).transferOutFees()
        // console.log(ethers.utils.formatEther(await DAIContract.balanceOf(treasury.address)))
        // console.log(ethers.utils.formatEther(await DAIContract.balanceOf(community.address)))
        // console.log(ethers.utils.formatEther(await DAIContract.balanceOf(strategist.address)))
        tx = await earnVault.connect(admin).invest()
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())

        // Change Curve Zap contract
        const curveZap2 = await CurveZap.deploy()
        await curveZap2.addPool(earnVault.address, curvePoolAddr, ethers.constants.AddressZero)
        await earnVault.setCurveZap(curveZap2.address)
        expect(await earnVault.curveZap()).to.equal(curveZap2.address)
        expect(await earnStrategy.curveZap()).to.equal(curveZap2.address)
        await DAIContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await sUSDContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await aDAIContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await aSUSDContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await AXSContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)

        // Balance keep in vault, retrieve LP token from strategy
        // console.log(ethers.utils.formatUnits(await earnVault.getAllPoolInUSD(), 6))
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))
        // await earnVault.connect(admin).retrievetokenFromStrategy(ethers.utils.parseEther("1000"))
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))

        // Yield
        tx = await earnVault.connect(admin).yield()
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        // console.log(ethers.utils.formatEther(await earnVault.getPricePerFullShare(false)))
        // console.log(ethers.utils.formatEther(await community.getBalance()))
        // console.log(ethers.utils.formatEther(await strategist.getBalance()))

        // Emergency withdraw
        const cvStake = new ethers.Contract("0xF86AE6790654b70727dbE58BF1a863B270317fD0", ["function balanceOf(address) external view returns (uint)"], deployer)
        // console.log(ethers.utils.formatEther(await cvStake.balanceOf(earnStrategy.address)))
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))
        await earnVault.connect(admin).emergencyWithdraw()
        await expect(earnVault.connect(client).deposit(ethers.utils.parseEther("10000"))).to.be.revertedWith("Pausable: paused")
        await expect(curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), DAIAddr)).to.be.revertedWith("Pausable: paused")
        // console.log(ethers.utils.formatEther(await cvStake.balanceOf(earnStrategy.address)))
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))
        await earnVault.connect(admin).reinvest()
        // console.log(ethers.utils.formatEther(await cvStake.balanceOf(earnStrategy.address)))
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))

        // Assume profit
        // await lpTokenContract.transfer(earnVault.address, ethers.utils.parseEther("1000"))

        // Withdraw
        const withdrawAmt = (await earnVault.balanceOf(client.address)).mul(1).div(10)
        await earnVault.connect(client).withdraw(withdrawAmt)
        // console.log("LP token withdraw:", ethers.utils.formatEther(await lpTokenContract.balanceOf(client.address)))
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, DAIAddr)
        // console.log("DAI withdraw:", ethers.utils.formatEther(await DAIContract.balanceOf(client.address)))
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, sUSDAddr)
        // console.log("sUSD withdraw:", ethers.utils.formatEther(await sUSDContract.balanceOf(client.address)))

        // Test deposit & withdraw with other contract
        const Sample = await ethers.getContractFactory("Sample", deployer)
        const sample = await Sample.deploy(lpTokenAddr, earnVault.address, curveZap2.address)
        await lpTokenContract.transfer(sample.address, ethers.utils.parseEther("1000"))
        tx = await sample.deposit()
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        // console.log(ethers.utils.formatEther(await earnVault.balanceOf(sample.address)))
        await expect(sample.withdraw()).to.be.revertedWith("Withdraw within locked period")
        network.provider.send("evm_increaseTime", [300])
        await sample.withdraw()

        // Change strategy
        await earnStrategyFactory.createStrategy(
            earnStrategyTemplate.address,
            poolIndex, curveZap2.address,
            admin.address, community.address, strategist.address
        )
        const earnStrategyAddr2 = await earnStrategyFactory.strategies((await earnStrategyFactory.getTotalStrategies()).sub(1))
        const earnStrategy2 = await ethers.getContractAt("EarnStrategy", earnStrategyAddr2, deployer)
        await earnStrategy2.setVault(earnVault.address)
        await earnVault.setPendingStrategy(earnStrategy2.address)
        await earnVault.connect(admin).emergencyWithdraw()
        await earnVault.unlockChangeStrategy()
        network.provider.send("evm_increaseTime", [86400*2])
        await earnVault.changeStrategy()
        await earnVault.connect(admin).reinvest()
        tx = await earnVault.connect(client).deposit(ethers.utils.parseEther("10000"))
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), DAIAddr)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), sUSDAddr)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), aDAIAddr)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), aSUSDAddr)
        await curveZap2.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("750"), AXSAddr)
        await curveZap2.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("5"), ethers.constants.AddressZero, {from: client.address, value: ethers.utils.parseEther("5")})
        await earnVault.connect(admin).invest()
        expect(await earnVault.strategy()).to.equal(earnStrategy2.address)
        expect((await curveZap2.poolInfos(earnVault.address))[1]).to.equal(earnStrategy2.address)
        await earnVault.connect(client).withdraw(withdrawAmt)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, DAIAddr)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, sUSDAddr)
        console.log("LP token withdraw:", ethers.utils.formatEther(await lpTokenContract.balanceOf(client.address)))
        console.log("DAI withdraw:", ethers.utils.formatEther(await DAIContract.balanceOf(client.address)))
        console.log("sUSD withdraw:", ethers.utils.formatEther(await sUSDContract.balanceOf(client.address)))

        // Set functions
        await earnVault.setNetworkFeeTier2([ethers.utils.parseEther("10000"), ethers.utils.parseEther("50000")])
        expect(await earnVault.networkFeeTier2(0)).to.equal(ethers.utils.parseEther("10000"))
        expect(await earnVault.networkFeeTier2(1)).to.equal(ethers.utils.parseEther("50000"))

        await earnVault.setCustomNetworkFeeTier(ethers.utils.parseEther("100000"))
        expect(await earnVault.customNetworkFeeTier()).to.equal(ethers.utils.parseEther("100000"))
        
        await earnVault.setNetworkFeePerc([200, 100, 75])
        expect(await earnVault.networkFeePerc(0)).to.equal(200)
        expect(await earnVault.networkFeePerc(1)).to.equal(100)
        expect(await earnVault.networkFeePerc(2)).to.equal(75)
        
        await earnVault.setCustomNetworkFeePerc(50)
        expect(await earnVault.customNetworkFeePerc()).to.equal(50)
        
        await earnVault.setProfitSharingFeePerc(2500)
        expect(await earnVault.profitSharingFeePerc()).to.equal(2500)
        
        await earnVault.setYieldFeePerc(2000)
        expect(await earnStrategy2.yieldFeePerc()).to.equal(2000)
        
        await earnVault.connect(admin).setPercTokenKeepInVault(1000)
        expect(await earnVault.percKeepInVault()).to.equal(1000)
        
        const sampleAddress = "0xb1AD074E17AD59f2103A8832DADE917388D6C50D"
        await earnVault.setTreasuryWallet(sampleAddress)
        expect(await earnVault.treasuryWallet()).to.equal(sampleAddress)
        
        await earnVault.setCommunityWallet(sampleAddress)
        expect(await earnVault.communityWallet()).to.equal(sampleAddress)
        expect(await earnStrategy2.communityWallet()).to.equal(sampleAddress)
        
        await earnVault.setBiconomy(sampleAddress)
        expect(await earnVault.trustedForwarder()).to.equal(sampleAddress)
        
        await curveZap2.setBiconomy(sampleAddress)
        expect(await curveZap2.trustedForwarder()).to.equal(sampleAddress)
        
        await earnVault.setAdmin(sampleAddress)
        expect(await earnVault.admin()).to.equal(sampleAddress)
        expect(await earnStrategy2.admin()).to.equal(sampleAddress)
        
        await earnVault.connect(strategist).setStrategist(sampleAddress)
        expect(await earnVault.strategist()).to.equal(sampleAddress)
        expect(await earnStrategy2.strategist()).to.equal(sampleAddress)
    })
})