const { ethers, upgrades, network } = require("hardhat")
const { expect } = require("chai")
const IERC20_ABI = require("../abis/IERC20_ABI.json")

const DAIAddr = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const USDCAddr = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const USDTAddr = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const TUSDAddr = "0x0000000000085d4780B73119b644AE5ecd22b376"
const yDAIAddr = "0x16de59092dAE5CcF4A1E6439D611fd0653f0Bd01"
const yUSDCAddr = "0xd6aD7a6750A7593E092a9B218d66C0A814a3436e"
const yUSDTAddr = "0x83f798e925BcD4017Eb265844FDDAbb448f1707D"
const yTUSDAddr = "0x73a052500105205d34Daf004eAb301916DA8190f"
const AXSAddr = "0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b"
const lpTokenAddr = "0xdF5e0e81Dff6FAF3A7e52BA697820c5e32D806A8" // *variable
const unlockedAddr = "0x28C6c06298d514Db089934071355E5743bf21d60"
const unlockedLpTokenAddr = "0x77D3C47876e45123C2837Ba68720378Af00a2C0A" // *variable
const unlockedyDAIAddr = "0x08b267C975b688b1b0d45EC5588CB759CBd95D26"
const unlockedyUSDCAddr = "0xd4e96561b4f39505A87651254BBaD2a1a9Fd5f1a"
const unlockedyUSDTAddr = "0xC4df36754341F6EAc693492e700475746FBb2FB8"
const unlockedyTUSDAddr = "0x0737Ea8c4358cE0EA04D46aaf362939F2BE3D6EC"

const curvePoolAddr = "0x45F783CCE6B7FF23B2ab2D70e416cdb7D6055f51" // *variable
const curveZapAddr = "0xbBC81d23Ea2c3ec7e56D39296F0cbB648873a5d3" // *variable

const poolIndex = 2 // *variable
const curveZapType = "CurveYZap" // *variable

describe("DAO Earn", () => {
    it("should work", async () => {
        let tx, receipt
        const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
        const CurveZap = await ethers.getContractFactory(curveZapType, deployer)
        const curveZap = await CurveZap.deploy()
        const EarnStrategyTemplate = await ethers.getContractFactory("EarnStrategy", deployer)
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
        await curveZap.addPool(earnVault.address, curvePoolAddr, curveZapAddr)
        // Transfer LP token to client
        await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedLpTokenAddr],});
        const unlockedLpTokenSigner = await ethers.getSigner(unlockedLpTokenAddr);
        const lpTokenContract = new ethers.Contract(lpTokenAddr, IERC20_ABI, unlockedLpTokenSigner);
        await lpTokenContract.transfer(client.address, ethers.utils.parseEther("20000"))
        await lpTokenContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
        // Transfer USDT/USDC/DAI/TUSD/AXS coin to client
        await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddr],});
        const unlockedSigner = await ethers.getSigner(unlockedAddr);
        const USDTContract = new ethers.Contract(USDTAddr, IERC20_ABI, unlockedSigner)
        const USDCContract = new ethers.Contract(USDCAddr, IERC20_ABI, unlockedSigner)
        const DAIContract = new ethers.Contract(DAIAddr, IERC20_ABI, unlockedSigner)
        const TUSDContract = new ethers.Contract(TUSDAddr, IERC20_ABI, unlockedSigner)
        const AXSContract = new ethers.Contract(AXSAddr, IERC20_ABI, unlockedSigner)
        await USDTContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
        await USDCContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
        await DAIContract.transfer(client.address, ethers.utils.parseEther("20000"))
        await TUSDContract.transfer(client.address, ethers.utils.parseEther("20000"))
        await AXSContract.transfer(client.address, ethers.utils.parseEther("20000"))
        await USDTContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        await USDCContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        await DAIContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        await TUSDContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        await AXSContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        // Transfer yUSDT/yUSDC/yDAI/yTUSD coin to client
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedyUSDTAddr],});
        const unlockedyUSDTSigner = await ethers.getSigner(unlockedyUSDTAddr);
        const yUSDTContract = new ethers.Contract(yUSDTAddr, IERC20_ABI, unlockedyUSDTSigner)
        await yUSDTContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
        await yUSDTContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedyUSDCAddr],});
        const unlockedyUSDCSigner = await ethers.getSigner(unlockedyUSDCAddr);
        const yUSDCContract = new ethers.Contract(yUSDCAddr, IERC20_ABI, unlockedyUSDCSigner)
        await yUSDCContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
        await yUSDCContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedyDAIAddr],});
        const unlockedyDAISigner = await ethers.getSigner(unlockedyDAIAddr);
        const yDAIContract = new ethers.Contract(yDAIAddr, IERC20_ABI, unlockedyDAISigner)
        await yDAIContract.transfer(client.address, ethers.utils.parseEther("20000"))
        await yDAIContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedyTUSDAddr],});
        const unlockedyTUSDSigner = await ethers.getSigner(unlockedyTUSDAddr);
        const yTUSDContract = new ethers.Contract(yTUSDAddr, IERC20_ABI, unlockedyTUSDSigner)
        await yTUSDContract.transfer(client.address, ethers.utils.parseEther("20000"))
        await yTUSDContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)

        // Deposit
        await earnVault.connect(client).deposit(ethers.utils.parseEther("10000"))
        // console.log(ethers.utils.formatEther(await earnVault.getAmtToInvest()))
        // console.log("Client share in USD:", ethers.utils.formatUnits((await earnVault.balanceOf(client.address)).mul(await earnVault.getPricePerFullShare(true)), 24))
        // console.log(ethers.utils.formatUnits(await earnVault.getPricePerFullShare(true), 6))
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("10000", 6), USDTAddr)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("10000", 6), USDCAddr)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), DAIAddr)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), TUSDAddr)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())

        // Invest
        tx = await earnVault.connect(admin).invest()
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())

        // Second deposit and invest, check fees
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("10000", 6), yUSDTAddr)
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("10000", 6), yUSDCAddr)
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), yDAIAddr)
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), yTUSDAddr)
        tx = await curveZap.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("750"), AXSAddr)
        tx = await curveZap.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("5"), ethers.constants.AddressZero, {from: client.address, value: ethers.utils.parseEther("5")})
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(treasury.address), 6))
        // await earnVault.connect(admin).transferOutFees()
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(treasury.address), 6))
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(community.address), 6))
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(strategist.address), 6))
        await earnVault.connect(admin).invest()

        // Change Curve Zap contract 
        const curveZap2 = await CurveZap.deploy()
        await curveZap2.addPool(earnVault.address, curvePoolAddr, curveZapAddr)
        await earnVault.setCurveZap(curveZap2.address)
        expect(await earnVault.curveZap()).to.equal(curveZap2.address)
        expect(await earnStrategy.curveZap()).to.equal(curveZap2.address)
        await USDTContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await USDCContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await DAIContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await TUSDContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await yUSDTContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await yUSDCContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await yDAIContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await yTUSDContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
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
        // const cvStake = new ethers.Contract("0x02E2151D4F351881017ABdF2DD2b51150841d5B3", ["function balanceOf(address) external view returns (uint)"], deployer)
        // console.log(ethers.utils.formatEther(await cvStake.balanceOf(earnStrategy.address)))
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))
        await earnVault.connect(admin).emergencyWithdraw()
        await expect(earnVault.connect(client).deposit(ethers.utils.parseEther("10000"))).to.be.revertedWith("Pausable: paused")
        await expect(curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("10000", 6), USDTAddr)).to.be.revertedWith("Pausable: paused")
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
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, USDTAddr)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, USDCAddr)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, DAIAddr)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, TUSDAddr)
        // console.log("LP token withdraw:", ethers.utils.formatEther(await lpTokenContract.balanceOf(client.address)))
        // console.log("USDT withdraw:", ethers.utils.formatUnits(await USDTContract.balanceOf(client.address), 6))
        // console.log("USDC withdraw:", ethers.utils.formatUnits(await USDCContract.balanceOf(client.address), 6))
        // console.log("DAI withdraw:", ethers.utils.formatEther(await DAIContract.balanceOf(client.address)))
        // console.log("TUSD withdraw:", ethers.utils.formatEther(await TUSDContract.balanceOf(client.address)))

        // Test deposit & withdraw with other contract
        const Sample = await ethers.getContractFactory("Sample", deployer)
        const sample = await Sample.deploy(lpTokenAddr, earnVault.address, curveZap2.address)
        await lpTokenContract.transfer(sample.address, ethers.utils.parseEther("1000"))
        tx = await sample.deposit()
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
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
        await earnVault.connect(client).deposit(ethers.utils.parseEther("10000"))
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("10000", 6), USDTAddr)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("10000", 6), USDCAddr)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), DAIAddr)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), TUSDAddr)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("10000", 6), yUSDTAddr)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("10000", 6), yUSDCAddr)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), yDAIAddr)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseEther("10000"), yTUSDAddr)
        await curveZap2.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("750"), AXSAddr)
        await curveZap2.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("5"), ethers.constants.AddressZero, {from: client.address, value: ethers.utils.parseEther("5")})
        await earnVault.connect(admin).invest()
        expect(await earnVault.strategy()).to.equal(earnStrategy2.address)
        expect(await curveZap2.strategy()).to.equal(earnStrategy2.address)
        await earnVault.connect(client).withdraw(withdrawAmt)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, USDTAddr)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, USDCAddr)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, DAIAddr)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, TUSDAddr)
        console.log("LP token withdraw:", ethers.utils.formatEther(await lpTokenContract.balanceOf(client.address)))
        console.log("USDT withdraw:", ethers.utils.formatUnits(await USDTContract.balanceOf(client.address), 6))
        console.log("USDC withdraw:", ethers.utils.formatUnits(await USDCContract.balanceOf(client.address), 6))
        console.log("DAI withdraw:", ethers.utils.formatEther(await DAIContract.balanceOf(client.address)))
        console.log("TUSD withdraw:", ethers.utils.formatEther(await TUSDContract.balanceOf(client.address)))

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