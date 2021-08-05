const { ethers, network } = require("hardhat")
const { expect } = require("chai")
const IERC20_ABI = require("../abis/IERC20_ABI.json")

const baseCoinAddr = "0x9559Aaa82d9649C7A7b220E7c461d2E74c9a3593" // *variable

const CRVAddr = "0xD533a949740bb3306d119CC777fa900bA034cd52"
const lpTokenAddr = "0x53a901d48795C58f485cBB38df08FA96a24669D5" // *variable

const unlockedAddr = "0x3bfE14B758D1cEc88e29C4748C09420b6E4319Db"
const unlockedLpTokenAddr = "0x807baf9e22f4e1e7a5fcf4b5721ba54666d71421" // *variable
const unlockedBaseCoinAddr = "0x56e773b0a620205e9f72265b6013b65b84c2c4af" // *variable

const curvePoolAddr = "0xF9440930043eb3997fc70e1339dBb11F341de7A8" // *variable

const poolIndex = 35 // *variable
const curveZapType = "CurvePlainPoolETHZap" // *variable

describe("DAO Earn", () => {
    it("should work", async () => {
        let tx, receipt, before, after
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
        const EarnVault = await ethers.getContractFactory("EarnVaultETH", deployer)
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
        // Transfer CRV coin to client
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedAddr],});
        const unlockedSigner = await ethers.getSigner(unlockedAddr);
        const CRVContract = new ethers.Contract(CRVAddr, IERC20_ABI, unlockedSigner)
        await CRVContract.transfer(client.address, ethers.utils.parseEther("4000"))
        await CRVContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)
        // Transfer base coin to client
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedBaseCoinAddr],});
        const unlockedBaseCoinSigner = await ethers.getSigner(unlockedBaseCoinAddr);
        const baseCoinContract = new ethers.Contract(baseCoinAddr, IERC20_ABI, unlockedBaseCoinSigner);
        await baseCoinContract.transfer(client.address, ethers.utils.parseUnits("2", 18))
        await baseCoinContract.connect(client).approve(curveZap.address, ethers.constants.MaxUint256)

        // Deposit
        await earnVault.connect(client).deposit(ethers.utils.parseUnits("1", 18), false)
        // console.log(ethers.utils.formatEther(await earnVault.getAmtToInvest()))
        // console.log("Client share in ETH:", ethers.utils.formatEther((await earnVault.balanceOf(client.address)).mul(await earnVault.getPricePerFullShare(true)).div(ethers.utils.parseEther("1"))))
        // console.log(ethers.utils.formatEther(await earnVault.getPricePerFullShare(true)))

        // Invest
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))
        // console.log(ethers.utils.formatEther(await earnVault.getAmtToInvest()))
        await earnVault.connect(admin).invest()
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))

        // Second deposit and invest, check fees
        tx = await curveZap.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("1", 18), baseCoinAddr, false)
        tx = await curveZap.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("2000"), CRVAddr, false)
        tx = await curveZap.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("1"), ethers.constants.AddressZero, false, {from: client.address, value: ethers.utils.parseEther("1")})
        // const WETHContract = new ethers.Contract("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", IERC20_ABI, unlockedSigner);
        // console.log(ethers.utils.formatUnits(await WETHContract.balanceOf(treasury.address), 18))
        // await earnVault.connect(admin).transferOutFees()
        // console.log(ethers.utils.formatUnits(await WETHContract.balanceOf(treasury.address), 18))
        // console.log(ethers.utils.formatUnits(await WETHContract.balanceOf(community.address), 18))
        // console.log(ethers.utils.formatUnits(await WETHContract.balanceOf(strategist.address), 18))
        tx = await earnVault.connect(admin).invest()
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())

        // Change Curve Zap contract 
        const curveZap2 = await CurveZap.deploy()
        await curveZap2.addPool(earnVault.address, curvePoolAddr)
        await earnVault.setCurveZap(curveZap2.address)
        expect(await earnVault.curveZap()).to.equal(curveZap2.address)
        expect(await earnStrategy.curveZap()).to.equal(curveZap2.address)
        await baseCoinContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)
        await CRVContract.connect(client).approve(curveZap2.address, ethers.constants.MaxUint256)

        // // Balance keep in vault, retrieve LP token from strategy
        // console.log(ethers.utils.formatEther(await earnVault.getAllPoolInETH()))
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
        const cvStake = new ethers.Contract("0x61dB6c2321f784c8fAb8d5eF80f58F27C831dCc8", ["function balanceOf(address) external view returns (uint)"], deployer)
        // console.log(ethers.utils.formatEther(await cvStake.balanceOf(earnStrategy.address)))
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))
        // const WETHAddr = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        // const WETHContract = new ethers.Contract(WETHAddr, IERC20_ABI, unlockedSigner);
        // await WETHContract.transfer(earnStrategy.address, ethers.utils.parseUnits("1", 11)) // To prevent too little WETH for swap to WBTC and cause error
        await earnVault.connect(admin).emergencyWithdraw()
        await expect(earnVault.connect(client).deposit(ethers.utils.parseEther("1", 18), false)).to.be.revertedWith("Pausable: paused")
        await expect(curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("1", 18), baseCoinAddr, false)).to.be.revertedWith("Pausable: paused")
        // console.log(ethers.utils.formatEther(await cvStake.balanceOf(earnStrategy.address)))
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))
        await earnVault.connect(admin).reinvest()
        // console.log(ethers.utils.formatEther(await cvStake.balanceOf(earnStrategy.address)))
        // console.log(ethers.utils.formatEther(await lpTokenContract.balanceOf(earnVault.address)))

        // Withdraw
        const withdrawAmt = (await earnVault.balanceOf(client.address)).mul(1).div(10)
        await earnVault.connect(client).withdraw(withdrawAmt)
        // console.log("LP token withdraw:", ethers.utils.formatEther(await lpTokenContract.balanceOf(client.address)))
        before = await client.getBalance()
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, ethers.constants.AddressZero)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        after = await client.getBalance()
        const first = after.sub(before)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, baseCoinAddr)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        // console.log("Base coin withdraw:", ethers.utils.formatEther(await baseCoinContract.balanceOf(client.address)))

        // Test deposit & withdraw with other contract
        const Sample = await ethers.getContractFactory("Sample", deployer)
        const sample = await Sample.deploy(lpTokenAddr, earnVault.address, curveZap2.address)
        await lpTokenContract.transfer(sample.address, ethers.utils.parseUnits("1", 18))
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
        tx = await earnVault.connect(client).deposit(ethers.utils.parseUnits("1", 18), false)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        await curveZap2.connect(client).deposit(earnVault.address, ethers.utils.parseUnits("1", 18), baseCoinAddr, false)
        await curveZap2.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("2000"), CRVAddr, false)
        await curveZap2.connect(client).depositZap(earnVault.address, ethers.utils.parseEther("1"), ethers.constants.AddressZero, false, {from: client.address, value: ethers.utils.parseEther("1")})
        await earnVault.connect(admin).invest()
        expect(await earnVault.strategy()).to.equal(earnStrategy2.address)
        expect((await curveZap2.poolInfos(earnVault.address))[1]).to.equal(earnStrategy2.address)
        await earnVault.connect(client).withdraw(withdrawAmt)
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, baseCoinAddr)
        before = await client.getBalance()
        tx = await curveZap2.connect(client).withdraw(earnVault.address, withdrawAmt, ethers.constants.AddressZero)
        after = await client.getBalance()
        const second = after.sub(before)
        console.log("LP token withdraw:", ethers.utils.formatEther(await lpTokenContract.balanceOf(client.address)))
        console.log("Base coin withdraw:", ethers.utils.formatUnits(await baseCoinContract.balanceOf(client.address), 18))
        console.log("ETH withdraw:", ethers.utils.formatEther(first.add(second)))

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
        await curveZap2.addPool(earnVault2.address, "0x0f9cb53Ebe405d49A0bbdBD291A65Ff571bC83e1")
    })
})