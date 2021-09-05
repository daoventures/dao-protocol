const { expect } = require("chai")
const { ethers, deployment, network } = require("hardhat")
const { mainnet: addresses } = require("../../addresses/moneyPrinter")
const IERC20_ABI = require("../../abis/IERC20_ABI.json")
const UNIRouterABI = require('../../artifacts/interfaces/IUniswapV2Router02.sol/IUniswapV2Router02.json').abi
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace")
require("dotenv").config()

const treasury = addresses.ADDRESSES.treasuryWallet
const communityWallet = addresses.ADDRESSES.communityWallet
const strategist = addresses.ADDRESSES.strategist
const setup = async () => {
    const [deployer, biconomy] = await ethers.getSigners()

    const USDT = new ethers.Contract(addresses.TOKENS.USDT, IERC20_ABI, deployer)
    const USDC = new ethers.Contract(addresses.TOKENS.USDC, IERC20_ABI, deployer)
    const DAI = new ethers.Contract(addresses.TOKENS.DAI, IERC20_ABI, deployer)

    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [addresses.UNLOCKED.address1]
    })


    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [addresses.UNLOCKED.address2]
    })

    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [addresses.ADDRESSES.adminAddress]
    })

    const admin = await ethers.getSigner(addresses.ADDRESSES.adminAddress)

    const quickSwapRouter = new ethers.Contract(addresses.QSWAP.ROUTER,UNIRouterABI,deployer)
    const moneyPrinterStrategy = await ethers.getContract("MoneyPrinterStrategy", deployer)
    // const moneyPrinterStrategy = await strategy.deploy(treasury.address)


    const moneyPrinterVault = await ethers.getContract("MoneyPrinterVault", deployer)
    /*     const moneyPrinterVault = await vault.deploy(moneyPrinterStrategy.address, admin.address, treasury.address, 
            communityWallet.address, strategist.address, biconomy.address);
        await moneyPrinterStrategy.connect(deployer).setVault(moneyPrinterVault.address) */


    // console.log('moneyPrinterVault.address', moneyPrinterVault.address)

    const unlockedUser = await ethers.getSigner(addresses.UNLOCKED.address1)
    const unlockedUser2 = await ethers.getSigner(addresses.UNLOCKED.address2)

    await USDT.connect(unlockedUser).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 6))
    await USDC.connect(unlockedUser).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 6))
    await DAI.connect(unlockedUser).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 18))

    await USDT.connect(unlockedUser2).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 6))
    await USDC.connect(unlockedUser2).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 6))
    await DAI.connect(unlockedUser2).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 18))

    await USDT.connect(unlockedUser2).approve(quickSwapRouter.address, ethers.utils.parseUnits("1000000000", 6))
    await USDC.connect(unlockedUser2).approve(quickSwapRouter.address, ethers.utils.parseUnits("1000000000", 6))
    await DAI.connect(unlockedUser2).approve(quickSwapRouter.address, ethers.utils.parseUnits("1000000000", 18))

    return { moneyPrinterVault, moneyPrinterStrategy, USDT, USDC, DAI, treasury, deployer, unlockedUser, admin, unlockedUser2, quickSwapRouter/* sampleContract */ }
}


const increaseTime = async (_timeInSeconds) => {
    await network.provider.request({
        method: "evm_increaseTime",
        params: [_timeInSeconds]
    })
}

const mine = async () => {
    await network.provider.request({
        method: "evm_mine",
        params: []
    })
}

describe("Money Printer - USDT", () => {
    
    beforeEach(async () => {
        await deployments.fixture(["mp_mainnet"])
    })

    it('Should deploy correctly', async() => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, treasury, unlockedUser} = await setup()
        // expect(await moneyPrinterStrategy.connect(admin).setVault(moneyPrinterVault.address)).to.be.revertedWith("Cannot set vault")
        // console.log("pendingStrategy", await moneyPrinterVault.connect(admin).pendingStrategy())
        await expect(await moneyPrinterVault.connect(unlockedUser).pendingStrategy()).to.equal(ethers.constants.AddressZero)
        await expect(await moneyPrinterVault.connect(unlockedUser).canSetPendingStrategy()).is.true
        await expect(await moneyPrinterVault.connect(unlockedUser).getValueInPool()).to.equal(0)
        await expect(await moneyPrinterVault.connect(unlockedUser).admin()).to.not.equal(ethers.constants.AddressZero)
        await expect(await moneyPrinterVault.connect(unlockedUser).treasuryWallet()).to.not.equal(ethers.constants.AddressZero)
        await expect(await moneyPrinterVault.connect(unlockedUser).communityWallet()).to.not.equal(ethers.constants.AddressZero)
        await expect(await moneyPrinterVault.connect(unlockedUser).strategist()).to.equal(strategist)
        await expect(await moneyPrinterVault.connect(unlockedUser).communityWallet()).to.equal(addresses.ADDRESSES.communityWallet)
        await expect(await moneyPrinterVault.connect(unlockedUser).treasuryWallet()).to.equal(addresses.ADDRESSES.treasuryWallet)
        await expect(await moneyPrinterVault.connect(unlockedUser).admin()).to.equal(addresses.ADDRESSES.adminAddress)

        await expect(await moneyPrinterStrategy.connect(unlockedUser).vault()).to.equal(moneyPrinterVault.address)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).treasury()).to.equal(treasury)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).strategist()).to.equal(strategist)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).communityWallet()).to.equal(communityWallet)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).DAI()).to.equal(addresses.TOKENS.DAI)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).USDC()).to.equal(addresses.TOKENS.USDC)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).USDT()).to.equal(addresses.TOKENS.USDT)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).MATIC()).to.equal(addresses.TOKENS.MATIC)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).CRV()).to.equal(addresses.TOKENS.CRV)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).Wexpoly()).to.equal(addresses.TOKENS.WEXPOLY)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).WexPolyRouter()).to.equal(addresses.WSWAP.ROUTER)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).quickSwapRouter()).to.equal(addresses.QSWAP.ROUTER)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).wexStakingContract()).to.equal(addresses.WSWAP.stakingContract)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).DAIUSDTQuickswapPool()).to.equal(addresses.QSWAP.stakingContract)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).rewardGauge()).to.equal(addresses.CURVE.REWARD_GUAGE)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).WexUSDT_USDCPair()).to.equal(addresses.WSWAP.USDT_USDCPair)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).QuickDAI_USDTPair()).to.equal(addresses.QSWAP.DAI_USDT_PAIR)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).curveFi()).to.equal(addresses.CURVE.aPAIR)
    })


})

describe("Owner functions", async() => {

    beforeEach(async () => {
        await deployments.fixture(["mp_mainnet"])
    })

    it('Should fail when owner is not calling', async() => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, deployer, unlockedUser} = await setup()
        await expect( moneyPrinterVault.connect(unlockedUser).setPendingStrategy(moneyPrinterStrategy.address)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect( moneyPrinterVault.connect(unlockedUser).setAdmin(admin.address)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect( moneyPrinterVault.connect(unlockedUser).setTreasuryWallet(admin.address)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect( moneyPrinterVault.connect(unlockedUser).setCommunityWallet(admin.address)).to.be.revertedWith("Ownable: caller is not the owner")
    })

    it('Should work correctly with Owner', async() => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, deployer, unlockedUser} = await setup()
        await moneyPrinterVault.connect(deployer).setPendingStrategy(moneyPrinterStrategy.address)
        await moneyPrinterVault.connect(deployer).setAdmin(admin.address)
        await moneyPrinterVault.connect(deployer).setTreasuryWallet(admin.address)
        await moneyPrinterVault.connect(deployer).setCommunityWallet(admin.address)
    })
})

describe("Admin functions", async() => {

    beforeEach(async () => {
        await deployments.fixture(["mp_mainnet"])
    })

    it('Should fail when admin is not calling', async() => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, deployer, unlockedUser} = await setup()
        await expect( moneyPrinterVault.connect(deployer).yield()).to.be.revertedWith("Only Admin")
        // await expect(await moneyPrinterVault.yield()).to.be.revertedWith("Only Admin")
    })

    it('Should work correctly with admin', async() => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, deployer, unlockedUser, USDT} = await setup()
        await moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDT.address)
        await increaseTime(3600000)
        await moneyPrinterVault.connect(admin).yield()
    })
})

describe("EmergencyWithdraw", async() => {

    beforeEach(async () => {
        await deployments.fixture(["mp_mainnet"])
    })
    
    it('Should work correctly', async () => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, USDT, unlockedUser} = await setup()
        await moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDT.address)
        await moneyPrinterVault.connect(admin).emergencyWithdraw(USDT.address)
        const balanceBefore = await USDT.balanceOf(unlockedUser.address)
        await moneyPrinterVault.connect(unlockedUser).withdraw(moneyPrinterVault.balanceOf(unlockedUser.address), USDT.address)
        const balanceAfter = await USDT.balanceOf(unlockedUser.address)

        expect(balanceAfter.gt(balanceBefore)) 
    }) 

    it('Should not allow other functions during emergency', async() => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, USDT, unlockedUser, deployer} = await setup()
        await moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDT.address)
        await moneyPrinterVault.connect(admin).emergencyWithdraw(USDT.address)
        await expect( moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDT.address)).to.be.revertedWith("Cannot deposit during emergency")
        await expect( moneyPrinterVault.connect(admin).yield()).to.be.revertedWith("Cannot call during emergency")
        // await expect( moneyPrinterVault.connect(deployer).migrateFunds(USDC.address)).to.be.revertedWith("Cannot call during emergency")
    })

    it('Should remove emergency on reInvest', async() => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, USDT, unlockedUser, unlockedUser2, deployer} = await setup()
        await moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDT.address)
        await moneyPrinterVault.connect(unlockedUser2).deposit(ethers.utils.parseUnits("50", 6), USDT.address)
        await increaseTime(3600000)
        await moneyPrinterVault.connect(admin).yield()
        await moneyPrinterVault.connect(admin).emergencyWithdraw(USDT.address)
        await moneyPrinterVault.connect(deployer).reInvest()
        await moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDT.address)
    })
}) 

describe("Normal flow", async () => {
    beforeEach(async () => {
        await deployments.fixture(["mp_mainnet"])
    })
    it('Should deposit, yield, withdraw correctly', async() => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, USDT, unlockedUser, unlockedUser2, deployer} = await setup()
        await moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDT.address)
        await moneyPrinterVault.connect(unlockedUser2).deposit(ethers.utils.parseUnits("50", 6), USDT.address)
        await increaseTime(3600000)
        await moneyPrinterVault.connect(admin).yield()
        let user1balanceBefore = await USDT.balanceOf(unlockedUser.address)
        let user2balanceBefore = await USDT.balanceOf(unlockedUser2.address)
        await moneyPrinterVault.connect(unlockedUser).withdraw(moneyPrinterVault.balanceOf(unlockedUser.address), USDT.address)
        await moneyPrinterVault.connect(unlockedUser2).withdraw(moneyPrinterVault.balanceOf(unlockedUser2.address), USDT.address)
        let user1balanceAfter = await USDT.balanceOf(unlockedUser.address)
        let user2balanceAfter = await USDT.balanceOf(unlockedUser2.address)

        console.log('amountWithdrawn-1', (user1balanceAfter.sub(user1balanceBefore)).toString())
        console.log('amountWithdrawn-2', (user2balanceAfter.sub(user2balanceBefore)).toString())
    })
 
    it("Should update poolValue correctly", async () => {
        const { moneyPrinterVault, moneyPrinterStrategy, admin, USDT, unlockedUser, unlockedUser2, deployer } = await setup()
        await moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDT.address)
        await moneyPrinterVault.connect(unlockedUser2).deposit(ethers.utils.parseUnits("50", 6), USDT.address)

        await moneyPrinterVault.connect(unlockedUser).withdraw(await moneyPrinterVault.balanceOf(unlockedUser.address), USDT.address)
        await moneyPrinterVault.connect(unlockedUser2).withdraw(await moneyPrinterVault.balanceOf(unlockedUser2.address), USDT.address)
        
        await expect(await moneyPrinterVault.getValueInPool()).to.equal(0)

    })

    it("Should update poolValue correctly - After liquidity changed", async () => {
        const { moneyPrinterVault, moneyPrinterStrategy, admin, USDT, DAI, unlockedUser, unlockedUser2, deployer, quickSwapRouter } = await setup()
        await moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDT.address)
        await moneyPrinterVault.connect(unlockedUser2).deposit(ethers.utils.parseUnits("50", 6), USDT.address)

        //execute large swap
        await quickSwapRouter.connect(unlockedUser2).swapExactTokensForTokens(ethers.utils.parseUnits("30000", 18), 0, [DAI.address, USDT.address], unlockedUser2.address,4120631147); //2100 year

        await moneyPrinterVault.connect(unlockedUser).withdraw(await moneyPrinterVault.balanceOf(unlockedUser.address), USDT.address)
        // console.log('valueInPool', (await moneyPrinterVault.getValueInPool()).toString())
        await moneyPrinterVault.connect(unlockedUser2).withdraw(await moneyPrinterVault.balanceOf(unlockedUser2.address), USDT.address)
        
        await expect(await moneyPrinterVault.getValueInPool()).to.equal(0)

    })

    it("Should transfer fee correctly on deposit", async () => {
        const { moneyPrinterVault, moneyPrinterStrategy, admin, USDT, unlockedUser, unlockedUser2, deployer } = await setup()
        let treasuryBefore = await USDT.balanceOf(treasury)
        let communityWalletBefore = await USDT.balanceOf(communityWallet)
        let strategistBefore = await USDT.balanceOf(strategist)

        let amountDeposited = ethers.utils.parseUnits("100", 6)
        let onePercentOfDeposited = amountDeposited.div(100)

        await moneyPrinterVault.connect(unlockedUser).deposit(amountDeposited, USDT.address)

        let treasuryAfter = await USDT.balanceOf(treasury)
        let communityWalletAfter = await USDT.balanceOf(communityWallet)
        let strategistAfter = await USDT.balanceOf(strategist)

        // console.log(onePercentOfDeposited.mul(40).div(100), treasuryAfter.toString(), treasuryBefore.toString())

        expect(treasuryAfter.sub(treasuryBefore)).to.equal(onePercentOfDeposited.mul(40).div(100))
        expect(communityWalletAfter.sub(communityWalletBefore)).to.equal(onePercentOfDeposited.mul(40).div(100))
        expect(strategistAfter.sub(strategistBefore)).to.equal(onePercentOfDeposited.mul(20).div(100))

    })


    it("Should transfer fee correctly on yield", async () => {
        const { moneyPrinterVault, moneyPrinterStrategy, admin, USDT, DAI, unlockedUser, unlockedUser2, deployer } = await setup()
        let treasuryBefore = await DAI.balanceOf(treasury)
        let communityWalletBefore = await DAI.balanceOf(communityWallet)
        let strategistBefore = await DAI.balanceOf(strategist)

        let amountDeposited = ethers.utils.parseUnits("10000", 6)

        await moneyPrinterVault.connect(unlockedUser).deposit(amountDeposited, USDT.address)
        
        await increaseTime(172800) //2 days
        await mine()
        await moneyPrinterVault.connect(admin).yield()
        
        let treasuryAfter = await DAI.balanceOf(treasury)
        let communityWalletAfter = await DAI.balanceOf(communityWallet)
        let strategistAfter = await DAI.balanceOf(strategist)


        expect(treasuryAfter).to.gt(treasuryBefore)
        expect(communityWalletAfter).to.gt(communityWalletBefore)
        expect(strategistAfter).to.gt(strategistBefore)
    })
}) 