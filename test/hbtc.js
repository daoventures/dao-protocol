const { ethers, network } = require("hardhat")
const { expect } = require("chai")
const IERC20_ABI = require("../abis/IERC20_ABI.json")

const WBTCAddr = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" // 8 decimals
const HBTCAddr = "0x0316EB71485b0Ab14103307bf65a021042c6d380"

const CRVAddr = "0xD533a949740bb3306d119CC777fa900bA034cd52"
const lpTokenAddr = "0xb19059ebb43466C323583928285a49f558E572Fd" // *variable

const unlockedAddr = "0x28C6c06298d514Db089934071355E5743bf21d60"
const unlockedAddr1 = "0x46705dfff24256421A05D056c29E81Bdc09723B8"
const unlockedLpTokenAddr = "0x7a7A599D2384ed203cFEA49721628aA851E0DA16" // *variable

const curvePoolAddr = "0x4CA9b3063Ec5866A4B82E437059D2C43d1be596F" // *variable

const poolIndex = 8 // *variable
const curveZapType = "CurveHBTCZap" // *variable

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
        const EarnVault = await ethers.getContractFactory("EarnVaultBTC", deployer)
        const earnVault = await upgrades.deployProxy(EarnVault, [
            await earnStrategy.lpToken(), earnStrategyAddr, curveZap.address,
            treasury.address, community.address,
            admin.address, strategist.address, biconomy.address
        ])
        await earnVault.deployed()
        await earnStrategy.setVault(earnVault.address)
        await curveZap.addPool(earnVault.address, curvePoolAddr)
        // Transfer LP token to client
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedLpTokenAddr],});
        const unlockedLpTokenSigner = await ethers.getSigner(unlockedLpTokenAddr);
        const lpTokenContract = new ethers.Contract(lpTokenAddr, IERC20_ABI, unlockedLpTokenSigner);
        await lpTokenContract.transfer(client.address, ethers.utils.parseUnits("2", 18))
        await lpTokenContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
        // Transfer WBTC/HBTC/CRV coin to client
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedAddr],});
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedAddr1],});
        const unlockedSigner = await ethers.getSigner(unlockedAddr);
        const unlockedSigner1 = await ethers.getSigner(unlockedAddr1);
        const WBTCContract = new ethers.Contract(WBTCAddr, IERC20_ABI, unlockedSigner)
        const HBTCContract = new ethers.Contract(HBTCAddr, IERC20_ABI, unlockedSigner1)
        const CRVContract = new ethers.Contract(CRVAddr, IERC20_ABI, unlockedSigner)
        await WBTCContract.transfer(client.address, ethers.utils.parseUnits("2", 8))
        await HBTCContract.transfer(client.address, ethers.utils.parseEther("2"))
        await CRVContract.transfer(client.address, ethers.utils.parseEther("2000"))
        await WBTCContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        await HBTCContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        await CRVContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)

        // Deposit
        await earnVault.connect(client).deposit(ethers.utils.parseUnits("1", 18), false)
        // console.log(ethers.utils.formatEther(await earnVault.getAmtToInvest()))
        // console.log("Client share in BTC:", ethers.utils.formatUnits((await earnVault.balanceOf(client.address)).mul(await earnVault.getPricePerFullShare(true)), 26))
        // console.log(ethers.utils.formatUnits(await earnVault.getPricePerFullShare(true), 8))
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("1", 8), WBTCAddr, false)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseEther("1"), HBTCAddr, false)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())

        // Invest
        tx = await earnVault.connect(admin).invest()
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())

        // Second deposit and invest, check fees
        tx = await curveZap.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("1000"), CRVAddr, false)
        tx = await curveZap.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("5"), ethers.constants.AddressZero, false, {from: client.address, value: ethers.utils.parseEther("5")})
        // await earnVault.connect(admin).transferOutFees()
        await earnVault.connect(admin).invest()

        // Change Curve Zap contract 
        const curveZap2 = await CurveZap.deploy()
        await curveZap2.addPool(earnVault.address, curvePoolAddr)
        await earnVault.setCurveZap(curveZap2.address)
        expect(await earnVault.curveZap()).to.equal(curveZap2.address)
        expect(await earnStrategy.curveZap()).to.equal(curveZap2.address)
        await WBTCContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await HBTCContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await CRVContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)

        // Balance keep in vault, retrieve LP token from strategy
        // console.log(ethers.utils.formatUnits(await earnVault.getAllPoolInBTC(), 8))
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))
        // await earnVault.connect(admin).retrievetokenFromStrategy(ethers.utils.parseEther("1"))
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))

        // Yield
        tx = await earnVault.connect(admin).yield()
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        // console.log(ethers.utils.formatEther(await earnVault.getPricePerFullShare(false)))
        // console.log(ethers.utils.formatEther(await community.getBalance()))
        // console.log(ethers.utils.formatEther(await strategist.getBalance()))

        // Emergency withdraw
        const cvStake = new ethers.Contract("0x618BD6cBA676a46958c63700C04318c84a7b7c0A", ["function balanceOf(address) external view returns (uint)"], deployer)
        // console.log(ethers.utils.formatEther(await cvStake.balanceOf(earnStrategy.address)))
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))
        const WETHAddr = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        const WETHContract = new ethers.Contract(WETHAddr, IERC20_ABI, unlockedSigner);
        await WETHContract.transfer(earnStrategy.address, ethers.utils.parseUnits("1", 12)) // To prevent too little WETH for swap to WBTC and cause error
        await earnVault.connect(admin).emergencyWithdraw()
        await expect(earnVault.connect(client).deposit(ethers.utils.parseEther("1"), false)).to.be.revertedWith("Pausable: paused")
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
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, WBTCAddr)
        // console.log("WBTC withdraw:", ethers.utils.formatUnits(await WBTCContract.balanceOf(client.address), 8))
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, HBTCAddr)
        // console.log("HBTC withdraw:", ethers.utils.formatEther(await HBTCContract.balanceOf(client.address)))

        // Test deposit & withdraw with other contract
        const Sample = await ethers.getContractFactory("Sample", deployer)
        const sample = await Sample.deploy(lpTokenAddr, earnVault.address, curveZap2.address)
        await lpTokenContract.transfer(sample.address, ethers.utils.parseUnits("1", 16))
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
        await earnVault.connect(client).deposit(ethers.utils.parseUnits("1", 18), false)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("1", 8), WBTCAddr, false)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseEther("1"), HBTCAddr, false)
        await curveZap2.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("1000"), CRVAddr, false)
        await curveZap2.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("5"), ethers.constants.AddressZero, false, {from: client.address, value: ethers.utils.parseEther("5")})
        await earnVault.connect(admin).invest()
        expect(await earnVault.strategy()).to.equal(earnStrategy2.address)
        expect(await curveZap2.strategy()).to.equal(earnStrategy2.address)
        await earnVault.connect(client).withdraw(withdrawAmt)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, WBTCAddr)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, HBTCAddr)
        console.log("LP token withdraw:", ethers.utils.formatEther(await lpTokenContract.balanceOf(client.address)))
        console.log("WBTC withdraw:", ethers.utils.formatUnits(await WBTCContract.balanceOf(client.address), 8))
        console.log("HBTC withdraw:", ethers.utils.formatEther(await HBTCContract.balanceOf(client.address)))

        // Add new pool in CurveZap
        await earnStrategyFactory.createStrategy(
            earnStrategyTemplate.address,
            13, curveZap2.address,
            admin.address, community.address, strategist.address
        )
        const earnStrategy3Addr = await earnStrategyFactory.strategies((await earnStrategyFactory.getTotalStrategies()).sub(1))
        const earnStrategy3 = await ethers.getContractAt("EarnStrategy", earnStrategy3Addr, deployer)
        const earnVault2 = await upgrades.deployProxy(EarnVault, [
            await earnStrategy3.lpToken(), earnStrategy3Addr, curveZap2.address,
            treasury.address, community.address,
            admin.address, strategist.address, biconomy.address
        ])
        await earnVault2.deployed()
        await earnStrategy3.setVault(earnVault2.address)
        await curveZap2.addPool(earnVault2.address, "0x0f9cb53Ebe405d49A0bbdBD291A65Ff571bC83e1")

        // Test function checkTokenSwapAvailability()
        // let res
        // const AXSAddr = "0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b"
        // const DVDAddr = "0x77dcE26c03a9B833fc2D7C31C22Da4f42e9d9582"
        // res = await curveZap2.checkTokenSwapAvailability(ethers.utils.parseEther("1000"), AXSAddr)
        // console.log(ethers.utils.formatUnits(res, 8))
        // res = await curveZap2.checkTokenSwapAvailability(ethers.utils.parseEther("1000"), DVDAddr)
        // console.log(ethers.utils.formatUnits(res, 8))
    })
})