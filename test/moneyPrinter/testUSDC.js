const { expect } = require("chai")
const { ethers, deployment, network } = require("hardhat")
const { mainnet: addresses } = require("../../addresses/moneyPrinter")
const IERC20_ABI = require("../../abis/IERC20_ABI.json")
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace")
require("dotenv").config()

const setup = async () => {
    const [deployer, treasury, admin, communityWallet, strategist, biconomy] = await ethers.getSigners()

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

    

    const strategy = await ethers.getContractFactory("MoneyPrinterStrategy", deployer) 
    const moneyPrinterStrategy = await strategy.deploy(treasury.address)
    

    const vault = await ethers.getContractFactory("MoneyPrinterVault", deployer)
    const moneyPrinterVault = await vault.deploy(moneyPrinterStrategy.address, admin.address, treasury.address, 
        communityWallet.address, strategist.address, biconomy.address);
    await moneyPrinterStrategy.connect(deployer).setVault(moneyPrinterVault.address)
    
    
    console.log('moneyPrinterVault.address', moneyPrinterVault.address)

    const unlockedUser = await ethers.getSigner(addresses.UNLOCKED.address1)
    const unlockedUser2 = await ethers.getSigner(addresses.UNLOCKED.address2)

    await USDT.connect(unlockedUser).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 6))
    await USDC.connect(unlockedUser).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 6))
    await DAI.connect(unlockedUser).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 18))

    await USDT.connect(unlockedUser2).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 6))
    await USDC.connect(unlockedUser2).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 6))
    await DAI.connect(unlockedUser2).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 18))

    return { moneyPrinterVault, moneyPrinterStrategy, USDT, USDC, DAI, treasury, deployer, unlockedUser, admin, unlockedUser2/* sampleContract */ }
}


const increaseTime = async (_timeInMilliSeconds)=> {
    let result = await network.provider.request({
        method: "evm_increaseTime",
        params: [_timeInMilliSeconds]
    })
}

describe("Money Printer - USDC", () => {

    it('Should deploy correctly', async() => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, treasury, unlockedUser} = await setup()
        // expect(await moneyPrinterStrategy.connect(admin).setVault(moneyPrinterVault.address)).to.be.revertedWith("Cannot set vault")
        console.log("pendingStrategy", await moneyPrinterVault.connect(admin).pendingStrategy())
        await expect(await moneyPrinterVault.connect(unlockedUser).pendingStrategy()).to.equal(ethers.constants.AddressZero)
        await expect(await moneyPrinterVault.connect(unlockedUser).canSetPendingStrategy()).is.true
        await expect(await moneyPrinterVault.connect(unlockedUser).getValueInPool()).to.equal(0)
        await expect(await moneyPrinterVault.connect(unlockedUser).admin()).to.not.equal(ethers.constants.AddressZero)
        await expect(await moneyPrinterVault.connect(unlockedUser).treasuryWallet()).to.not.equal(ethers.constants.AddressZero)
        await expect(await moneyPrinterVault.connect(unlockedUser).communityWallet()).to.not.equal(ethers.constants.AddressZero)
        await expect(await moneyPrinterVault.connect(unlockedUser).strategist()).to.not.equal(ethers.constants.AddressZero)

        await expect(await moneyPrinterStrategy.connect(unlockedUser).vault()).to.equal(moneyPrinterVault.address)
        await expect(await moneyPrinterStrategy.connect(unlockedUser).treasury()).to.equal(treasury.address)
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
    it('Should fail when admin is not calling', async() => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, deployer, unlockedUser} = await setup()
        await expect( moneyPrinterVault.connect(deployer).yield()).to.be.revertedWith("Only Admin")
        // await expect(await moneyPrinterVault.yield()).to.be.revertedWith("Only Admin")
    })

    it('Should work correctly with admin', async() => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, deployer, unlockedUser, USDC} = await setup()
        await moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDC.address)
        await increaseTime(3600000)
        await moneyPrinterVault.connect(admin).yield()
    })
})

describe("EmergencyWithdraw", async() => {
    
    it('Should work correctly', async () => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, USDC, unlockedUser} = await setup()
        await moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDC.address)
        await moneyPrinterVault.connect(admin).emergencyWithdraw(USDC.address)
        const balanceBefore = await USDC.balanceOf(unlockedUser.address)
        await moneyPrinterVault.connect(unlockedUser).withdraw(moneyPrinterVault.balanceOf(unlockedUser.address), USDC.address)
        const balanceAfter = await USDC.balanceOf(unlockedUser.address)

        expect(balanceAfter.gt(balanceBefore)) 
    }) 

    it('Should not allow other functions during emergency', async() => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, USDC, unlockedUser, deployer} = await setup()
        await expect( moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDC.address)).to.be.revertedWith("Cannot deposit during emergency")
        await expect( moneyPrinterVault.connect(admin).yield()).to.be.revertedWith("Cannot call during emergency")
        await expect( moneyPrinterVault.connect(deployer).migrateFunds(USDC.address)).to.be.revertedWith("Cannot call during emergency")
    })

    it('Should remove emergency on reInvest', async() => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, USDC, unlockedUser, deployer} = await setup()
        await moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDC.address)
        await moneyPrinterVault.connect(admin).emergencyWithdraw(USDC.address)
        await moneyPrinterVault.connect(deployer).reInvest()
        await moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDC.address)
    })
})

describe("Normal flow", async() => {
    it('Should deposit, yield, withdraw correctly', async() => {
        const {moneyPrinterVault, moneyPrinterStrategy, admin, USDC, unlockedUser, deployer} = await setup()
        await moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDC.address)
        await increaseTime(3600000)
        await moneyPrinterVault.connect(admin).yield()
        await moneyPrinterVault.connect(unlockedUser).withdraw(moneyPrinterVault.balanceOf(unlockedUser.address), USDC.address)
    })
})