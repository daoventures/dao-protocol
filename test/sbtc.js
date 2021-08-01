const { ethers, network } = require("hardhat")
const { expect } = require("chai")
const IERC20_ABI = require("../abis/IERC20_ABI.json")

const renBTCAddr = "0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D" // 8 decimals
const WBTCAddr = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" // 8 decimals
const sBTCAddr = "0xfE18be6b3Bd88A2D2A7f928d00292E7a9963CfC6"

const CRVAddr = "0xD533a949740bb3306d119CC777fa900bA034cd52"
const lpTokenAddr = "0x075b1bb99792c9E1041bA13afEf80C91a1e70fB3" // *variable

const unlockedAddr = "0x3bfE14B758D1cEc88e29C4748C09420b6E4319Db"
const unlockedLpTokenAddr = "0xB65cef03b9B89f99517643226d76e286ee999e77" // *variable

const curvePoolAddr = "0x7fC77b5c7614E1533320Ea6DDc2Eb61fa00A9714" // *variable

const poolIndex = 7 // *variable
const curveZapType = "CurveSBTCZap" // *variable

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
        // Transfer renBTC/WBTC/sBTC/CRV coin to client
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedAddr],});
        const unlockedSigner = await ethers.getSigner(unlockedAddr);
        const renBTCContract = new ethers.Contract(renBTCAddr, IERC20_ABI, unlockedSigner)
        const WBTCContract = new ethers.Contract(WBTCAddr, IERC20_ABI, unlockedSigner)
        const sBTCContract = new ethers.Contract(sBTCAddr, IERC20_ABI, unlockedSigner)
        const CRVContract = new ethers.Contract(CRVAddr, IERC20_ABI, unlockedSigner)
        await renBTCContract.transfer(client.address, ethers.utils.parseUnits("2", 8))
        await WBTCContract.transfer(client.address, ethers.utils.parseUnits("2", 8))
        await sBTCContract.transfer(client.address, ethers.utils.parseEther("2"))
        await CRVContract.transfer(client.address, ethers.utils.parseEther("2000"))
        await renBTCContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        await WBTCContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        await sBTCContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        await CRVContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)

        // Deposit
        await earnVault.connect(client).deposit(ethers.utils.parseUnits("1", 18), false)
        // console.log(ethers.utils.formatEther(await earnVault.getAmtToInvest()))
        // console.log("Client share in USD:", ethers.utils.formatUnits((await earnVault.balanceOf(client.address)).mul(await earnVault.getPricePerFullShare(true)), 24))
        // console.log(ethers.utils.formatUnits(await earnVault.getPricePerFullShare(true), 6))
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("1", 8), renBTCAddr, false)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("1", 8), WBTCAddr, false)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseEther("1"), sBTCAddr, false)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())

        // Invest
        tx = await earnVault.connect(admin).invest()
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())

        // Second deposit and invest, check fees
        tx = await curveZap.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("1000"), CRVAddr, false)
        tx = await curveZap.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("5"), ethers.constants.AddressZero, false, {from: client.address, value: ethers.utils.parseEther("5")})
        // console.log(ethers.utils.formatUnits(await renBTCContract.balanceOf(treasury.address), 6))
        // await earnVault.connect(admin).transferOutFees()
        // console.log(ethers.utils.formatUnits(await renBTCContract.balanceOf(treasury.address), 6))
        // console.log(ethers.utils.formatUnits(await renBTCContract.balanceOf(community.address), 6))
        // console.log(ethers.utils.formatUnits(await renBTCContract.balanceOf(strategist.address), 6))
        await earnVault.connect(admin).invest()

        // Change Curve Zap contract 
        const curveZap2 = await CurveZap.deploy()
        await curveZap2.addPool(earnVault.address, curvePoolAddr)
        await earnVault.setCurveZap(curveZap2.address)
        expect(await earnVault.curveZap()).to.equal(curveZap2.address)
        expect(await earnStrategy.curveZap()).to.equal(curveZap2.address)
        await renBTCContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await WBTCContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await sBTCContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await CRVContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)

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
        const WETHAddr = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        const WETHContract = new ethers.Contract(WETHAddr, IERC20_ABI, unlockedSigner);
        await WETHContract.transfer(earnStrategy.address, ethers.utils.parseUnits("1", 12)) // To prevent too little WETH for swap to WBTC and cause error
        await earnVault.connect(admin).emergencyWithdraw()
        await expect(earnVault.connect(client).deposit(ethers.utils.parseEther("1"), false)).to.be.revertedWith("Pausable: paused")
        await expect(curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("1", 8), renBTCAddr, false)).to.be.revertedWith("Pausable: paused")
        // console.log(ethers.utils.formatEther(await cvStake.balanceOf(earnStrategy.address)))
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))
        await earnVault.connect(admin).reinvest()
        // console.log(ethers.utils.formatEther(await cvStake.balanceOf(earnStrategy.address)))
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))

        // Withdraw
        const withdrawAmt = (await earnVault.balanceOf(client.address)).mul(1).div(10)
        await earnVault.connect(client).withdraw(withdrawAmt)
        // console.log("LP token withdraw:", ethers.utils.formatEther(await lpTokenContract.balanceOf(client.address)))
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, renBTCAddr)
        // console.log("renBTC withdraw:", ethers.utils.formatUnits(await renBTCContract.balanceOf(client.address), 6))
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, WBTCAddr)
        // console.log("WBTC withdraw:", ethers.utils.formatUnits(await WBTCContract.balanceOf(client.address), 6))
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, sBTCAddr)
        // console.log("sBTC withdraw:", ethers.utils.formatEther(await sBTCContract.balanceOf(client.address)))

        // Test deposit & withdraw with other contract
        const Sample = await ethers.getContractFactory("Sample", deployer)
        const sample = await Sample.deploy(lpTokenAddr, earnVault.address, curveZap2.address)
        await lpTokenContract.transfer(sample.address, ethers.utils.parseEther("1"))
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
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("1", 8), renBTCAddr, false)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("1", 8), WBTCAddr, false)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseEther("1"), sBTCAddr, false)
        await curveZap2.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("1000"), CRVAddr, false)
        await curveZap2.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("5"), ethers.constants.AddressZero, false, {from: client.address, value: ethers.utils.parseEther("5")})
        await earnVault.connect(admin).invest()
        expect(await earnVault.strategy()).to.equal(earnStrategy2.address)
        expect(await curveZap2.strategy()).to.equal(earnStrategy2.address)
        await earnVault.connect(client).withdraw(withdrawAmt)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, renBTCAddr)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, WBTCAddr)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, sBTCAddr)
        console.log("LP token withdraw:", ethers.utils.formatEther(await lpTokenContract.balanceOf(client.address)))
        console.log("renBTC withdraw:", ethers.utils.formatUnits(await renBTCContract.balanceOf(client.address), 8))
        console.log("WBTC withdraw:", ethers.utils.formatUnits(await WBTCContract.balanceOf(client.address), 8))
        console.log("sBTC withdraw:", ethers.utils.formatEther(await sBTCContract.balanceOf(client.address)))

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
    })
})