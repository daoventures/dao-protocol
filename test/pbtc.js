const { ethers, network } = require("hardhat")
const { expect } = require("chai")
const IERC20_ABI = require("../abis/IERC20_ABI.json")

const renBTCAddr = "0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D" // 8 decimals
const WBTCAddr = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" // 8 decimals
const sBTCAddr = "0xfE18be6b3Bd88A2D2A7f928d00292E7a9963CfC6"
const baseCoinAddr = "0x5228a22e72ccC52d415EcFd199F99D0665E7733b" // *variable // 18 decimals

const crvRenWSBTCAddr = "0x075b1bb99792c9E1041bA13afEf80C91a1e70fB3"
const CRVAddr = "0xD533a949740bb3306d119CC777fa900bA034cd52"
const lpTokenAddr = "0xDE5331AC4B3630f94853Ff322B66407e0D6331E8" // *variable

const unlockedAddr = "0x3bfE14B758D1cEc88e29C4748C09420b6E4319Db"
const unlockedLpTokenAddr = "0x67031973f76ABCD80d8635eE18865813298923b4" // *variable
const unlockedBaseCoinAddr = "0x876EabF441B2EE5B5b0554Fd502a8E0600950cFa" // *variable
const unlockedCrvRenWSBTCAddr = "0x545946fcAE98Afb4333B788b8F530046eB8Ed997"

const curvePoolAddr = "0x7F55DDe206dbAD629C080068923b36fe9D6bDBeF" // *variable
const curvePoolZap = "0x11F419AdAbbFF8d595E7d5b223eee3863Bb3902C" // *variable

const poolIndex = 18 // *variable
const curveZapType = "CurveMetaPoolBTCZap" // *variable

describe("DAO Earn", () => {
    it("should work", async () => {
        let tx, receipt
        const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
        const CurveZap = await ethers.getContractFactory(curveZapType, deployer)
        const curveZap = await CurveZap.deploy()
        const EarnStrategyTemplate = await ethers.getContractFactory("EarnStrategyUNIv2", deployer)
        const earnStrategyTemplate = await EarnStrategyTemplate.deploy()
        const EarnStrategyFactory = await ethers.getContractFactory("EarnStrategyFactory", deployer)
        const earnStrategyFactory = await EarnStrategyFactory.deploy()
        await earnStrategyFactory.createStrategy(
            earnStrategyTemplate.address,
            poolIndex, curveZap.address,
            admin.address, community.address, strategist.address
        )
        const earnStrategyAddr = await earnStrategyFactory.strategies((await earnStrategyFactory.getTotalStrategies()).sub(1))
        const earnStrategy = await ethers.getContractAt("EarnStrategyUNIv2", earnStrategyAddr, deployer)
        const EarnVault = await ethers.getContractFactory("EarnVaultBTC", deployer)
        const earnVault = await upgrades.deployProxy(EarnVault, [
            await earnStrategy.lpToken(), earnStrategyAddr, curveZap.address,
            treasury.address, community.address,
            admin.address, strategist.address, biconomy.address
        ])
        await earnVault.deployed()
        await earnStrategy.setVault(earnVault.address)
        await curveZap.addPool(earnVault.address, curvePoolAddr, curvePoolZap)
        // Transfer LP token to client
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedLpTokenAddr],});
        const unlockedLpTokenSigner = await ethers.getSigner(unlockedLpTokenAddr);
        const lpTokenContract = new ethers.Contract(lpTokenAddr, IERC20_ABI, unlockedLpTokenSigner);
        await lpTokenContract.transfer(client.address, ethers.utils.parseUnits("2", 16))
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
        // Transfer base coin to client
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedBaseCoinAddr],});
        const unlockedBaseCoinSigner = await ethers.getSigner(unlockedBaseCoinAddr);
        const baseCoinContract = new ethers.Contract(baseCoinAddr, IERC20_ABI, unlockedBaseCoinSigner);
        await baseCoinContract.transfer(client.address, ethers.utils.parseUnits("2", 18))
        await baseCoinContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        // Transfer crvRenWSBTC to client
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedCrvRenWSBTCAddr],});
        const unlockedCrvRenWSBTCSigner = await ethers.getSigner(unlockedCrvRenWSBTCAddr);
        const crvRenWSBTCContract = new ethers.Contract(crvRenWSBTCAddr, IERC20_ABI, unlockedCrvRenWSBTCSigner);
        await crvRenWSBTCContract.transfer(client.address, ethers.utils.parseEther("2"))
        await crvRenWSBTCContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)

        // Deposit
        await earnVault.connect(client).deposit(ethers.utils.parseUnits("1", 16), false)
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
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("1", 18), baseCoinAddr, false)
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseEther("1"), crvRenWSBTCAddr, false)
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
        await curveZap2.addPool(earnVault.address, curvePoolAddr, curvePoolZap)
        await earnVault.setCurveZap(curveZap2.address)
        expect(await earnVault.curveZap()).to.equal(curveZap2.address)
        expect(await earnStrategy.curveZap()).to.equal(curveZap2.address)
        await renBTCContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await WBTCContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await sBTCContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await baseCoinContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await crvRenWSBTCContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
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
        await WETHContract.transfer(earnStrategy.address, ethers.utils.parseUnits("1", 11)) // To prevent too little WETH for swap to WBTC and cause error
        await earnVault.connect(admin).emergencyWithdraw()
        await expect(earnVault.connect(client).deposit(ethers.utils.parseEther("1", 16), false)).to.be.revertedWith("Pausable: paused")
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
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, baseCoinAddr)
        // console.log("Base coin withdraw:", ethers.utils.formatEther(await baseCoinContract.balanceOf(client.address)))

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
        const earnStrategy2 = await ethers.getContractAt("EarnStrategyUNIv2", earnStrategyAddr2, deployer)
        await earnStrategy2.setVault(earnVault.address)
        await earnVault.setPendingStrategy(earnStrategy2.address)
        await earnVault.connect(admin).emergencyWithdraw()
        await earnVault.unlockChangeStrategy()
        network.provider.send("evm_increaseTime", [86400*2])
        await earnVault.changeStrategy()
        await earnVault.connect(admin).reinvest()
        await earnVault.connect(client).deposit(ethers.utils.parseUnits("1", 16), false)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("1", 8), renBTCAddr, false)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("1", 8), WBTCAddr, false)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseEther("1"), sBTCAddr, false)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("1", 18), baseCoinAddr, false)
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseEther("1"), crvRenWSBTCAddr, false)
        await curveZap2.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("1000"), CRVAddr, false)
        await curveZap2.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("5"), ethers.constants.AddressZero, false, {from: client.address, value: ethers.utils.parseEther("5")})
        await earnVault.connect(admin).invest()
        expect(await earnVault.strategy()).to.equal(earnStrategy2.address)
        expect((await curveZap2.poolInfos(earnVault.address))[2]).to.equal(earnStrategy2.address)
        await earnVault.connect(client).withdraw(withdrawAmt)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, renBTCAddr)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, WBTCAddr)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, sBTCAddr)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, baseCoinAddr)
        console.log("LP token withdraw:", ethers.utils.formatEther(await lpTokenContract.balanceOf(client.address)))
        console.log("renBTC withdraw:", ethers.utils.formatUnits(await renBTCContract.balanceOf(client.address), 8))
        console.log("WBTC withdraw:", ethers.utils.formatUnits(await WBTCContract.balanceOf(client.address), 8))
        console.log("sBTC withdraw:", ethers.utils.formatEther(await sBTCContract.balanceOf(client.address)))
        console.log("Base coin withdraw:", ethers.utils.formatUnits(await baseCoinContract.balanceOf(client.address), 18))

        // Add new pool in CurveZap
        await earnStrategyFactory.createStrategy(
            earnStrategyTemplate.address,
            13, curveZap2.address,
            admin.address, community.address, strategist.address
        )
        const earnStrategy3Addr = await earnStrategyFactory.strategies((await earnStrategyFactory.getTotalStrategies()).sub(1))
        const earnStrategy3 = await ethers.getContractAt("EarnStrategyUNIv2", earnStrategy3Addr, deployer)
        const earnVault2 = await upgrades.deployProxy(EarnVault, [
            await earnStrategy3.lpToken(), earnStrategy3Addr, curveZap2.address,
            treasury.address, community.address,
            admin.address, strategist.address, biconomy.address
        ])
        await earnVault2.deployed()
        await earnStrategy3.setVault(earnVault2.address)
        await curveZap2.addPool(earnVault2.address, "0x0f9cb53Ebe405d49A0bbdBD291A65Ff571bC83e1", "0x094d12e5b541784701FD8d65F11fc0598FBC6332")
    })
})