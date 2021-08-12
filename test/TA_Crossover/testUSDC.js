const {expect} = require("chai")
const {ethers, deployments, network} = require('hardhat')
const {mainnet :addresses} = require('../../addresses/TA_Crossover') //TODO
const IERC20_ABI = require("../../abis/IERC20_ABI.json")//TODO
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace")


const USDTAddress = addresses.TOKENS.USDT
const USDCAddress = addresses.TOKENS.USDC
const DAIAddress = addresses.TOKENS.DAI
const unlockedAddress = "0xc247722Ac42B2f9BA752886502c3D3dD39BDb2Da"//addresses.ADDRESSES.unlockedUser
const unlockedAddress2 = "0xF39d30Fa570db7940e5b3A3e42694665A1449E4B"//addresses.ADDRESSES.unlockedUser2


const increaseTime = async (_timeInMilliSeconds)=> {
    let result = await network.provider.request({
        method: "evm_increaseTime",
        params: [_timeInMilliSeconds]
    })
}


const mine = async () => {
    await network.provider.request({
        method: "evm_mine",
        params: []
    })
}
describe("TA - USDC", () => {
    const setup = async () => {
        const [ deployer ] = await ethers.getSigners()

        const USDT = new ethers.Contract(USDTAddress, IERC20_ABI, deployer)
        const USDC = new ethers.Contract(USDCAddress, IERC20_ABI, deployer)
        const DAI = new ethers.Contract(DAIAddress, IERC20_ABI, deployer)
        const SUSHI = new ethers.Contract(addresses.TOKENS.SUSHI, IERC20_ABI, deployer)
        const WETH = new ethers.Contract(addresses.TOKENS.WETH, IERC20_ABI, deployer)
        const WBTC = new ethers.Contract(addresses.TOKENS.WBTC, IERC20_ABI, deployer)

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [unlockedAddress]
        })


        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [unlockedAddress2]
        })

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [addresses.ADDRESSES.adminAddress]
        })

        const strategy = await ethers.getContract("TAstrategy")
        const vault = await ethers.getContract("TAvault")

        const unlockedUser = await ethers.getSigner(unlockedAddress)
        const unlockedUser2 = await ethers.getSigner(unlockedAddress2)
        const adminSigner = await ethers.getSigner(addresses.ADDRESSES.adminAddress)

        await USDT.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 6))
        await USDC.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 6))
        await DAI.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))

        await USDT.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 6))
        await USDC.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 6))
        await DAI.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))

        return {vault, strategy, USDT, USDC, DAI,unlockedUser ,unlockedUser2, adminSigner, deployer}
    }

    beforeEach(async () => {
        await deployments.fixture(["ta_mainnet"])
    })


    it("Should deploy correctly", async() => {
        const {vault, strategy, USDC, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer} = await setup()
        expect(await vault.communityWallet()).to.be.equal(addresses.ADDRESSES.communityWallet)
        expect(await vault.treasuryWallet()).to.be.equal(addresses.ADDRESSES.treasuryWallet)
        expect(await vault.strategist()).to.be.equal(addresses.ADDRESSES.strategist)
        expect(await vault.trustedForwarder()).to.be.equal(addresses.ADDRESSES.trustedForwarder)
        expect(await vault.admin()).to.be.equal(addresses.ADDRESSES.adminAddress)
        expect(await vault.canSetPendingStrategy()).to.be.true
        expect(await strategy.vault()).to.be.equal(vault.address)
        expect(await vault.strategy()).to.be.equal(strategy.address)
        expect(await strategy.communityWallet()).to.be.equal(addresses.ADDRESSES.communityWallet)
        expect(await strategy.treasury()).to.be.equal(addresses.ADDRESSES.treasuryWallet)
        expect(await strategy.strategist()).to.be.equal(addresses.ADDRESSES.strategist)  
    })
// 
    it("Should yield correctly", async() => {//TODO - check
        const {vault, strategy, USDC, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer} = await setup()
        await vault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), 1)
        await vault.connect(adminSigner).invest()
        await vault.connect(unlockedUser2).deposit(ethers.utils.parseUnits("100", 6), 1)
        await vault.connect(adminSigner).invest()
        let valueInPoolInitial = await vault.getAllPoolInUSD()
// 
        await increaseTime(86400)//(432000)
        await vault.connect(adminSigner).yield()
        let valueInPoolAfter = await vault.getAllPoolInUSD()
// 
        expect(valueInPoolAfter.toNumber()).to.be.greaterThan(valueInPoolInitial.toNumber())
    })

    it("Should switch pools correctly", async() => {
        const {vault, strategy, USDC, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer} = await setup()
        await vault.connect(unlockedUser).deposit(ethers.utils.parseUnits("1000", 6), 1)
        await vault.connect(unlockedUser2).deposit(ethers.utils.parseUnits("100000", 6), 1)
        let shares = await vault.balanceOf(unlockedUser2.address)
        let balanceBefore = await USDC.balanceOf(unlockedUser2.address)
        await vault.connect(adminSigner).invest()
// 
        await vault.connect(adminSigner).switchMode(1)
        await vault.connect(adminSigner).switchMode(0)
// 
        await vault.connect(unlockedUser2).withdraw(shares, 1)
        let balanceAfter = await USDC.balanceOf(unlockedUser2.address)
// 
        // console.log('Withdrawn', (balanceAfter.sub(balanceBefore)).toString())
    })


    it("Should work - normal flow", async() => {
        const {vault, strategy, USDC, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer} = await setup()
        await vault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), 1)
        await vault.connect(unlockedUser2).deposit(ethers.utils.parseUnits("10000", 6), 1)
        let balanceBefore = await USDC.balanceOf(unlockedUser.address)
        let balanceBefore2 = await USDC.balanceOf(unlockedUser2.address)
        let shares = await vault.balanceOf(unlockedUser.address)
        let sharesUser2 = await vault.balanceOf(unlockedUser2.address)
        await vault.connect(adminSigner).invest()
        await vault.connect(unlockedUser).withdraw(shares, 1)
        await vault.connect(unlockedUser2).withdraw(sharesUser2, 1)
        let balanceAfter = await USDC.balanceOf(unlockedUser.address)
        // console.log('withdrawn ', (balanceAfter.sub(balanceBefore).toString()))
        let valueInPool = await vault.getAllPoolInUSD()
        // console.log('valueInPool', valueInPool.toString())
// 
        let balanceAfter2 = await USDC.balanceOf(unlockedUser2.address)
        // console.log('withdrawn ', (balanceAfter2.sub(balanceBefore2).toString()))
        valueInPool = await vault.getAllPoolInUSD()
        // console.log('valueInPool', valueInPool.toString())
    })
    it("Should withdraw all funds in emergencyWithdraw", async() => {
        const {vault, strategy, USDC, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer} = await setup()
        await vault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), 1)
        await vault.connect(unlockedUser2).deposit(ethers.utils.parseUnits("10000", 6), 1)
        let shares = await vault.balanceOf(unlockedUser2.address)
        await vault.connect(adminSigner).invest()
        await vault.connect(adminSigner).emergencyWithdraw()
        await vault.connect(unlockedUser2).withdraw(shares, 1)
    })

    it("Should revert other functions on emergency", async() => {
        const {vault, strategy, USDC, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer} = await setup()
        await vault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), 1)
        await vault.connect(unlockedUser2).deposit(ethers.utils.parseUnits("10000", 6), 1)
        await vault.connect(adminSigner).invest()

        await vault.connect(adminSigner).emergencyWithdraw()
        await expect(vault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), 1)).to.be.revertedWith("Cannot deposit during emergency")
        await expect(vault.connect(adminSigner).invest()).to.be.revertedWith("Cannot call during emergency")
        await expect(vault.connect(adminSigner).yield()).to.be.revertedWith("Cannot call during emergency")

    })

    it("Should enable all functions on reinvest", async() => {
        const {vault, strategy, USDC, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer} = await setup()
        await vault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), 1)
        await vault.connect(adminSigner).emergencyWithdraw()
// 
        await vault.connect(adminSigner).reinvest()
// 
        await vault.connect(adminSigner).invest()
        await vault.connect(adminSigner).yield()
    })
// 
    it("should work correctly - migrateFunds", async() => {
        const {vault, strategy, USDC, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer} = await setup()
        await vault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), 1)
        let shares = await vault.balanceOf(unlockedUser.address)
        let beforeBalance = await USDC.balanceOf(unlockedUser.address)
        await vault.connect(adminSigner).invest()
// 
        await vault.connect(deployer).setPendingStrategy(strategy.address)
        await vault.connect(deployer).unlockMigrateFunds()
// 
        await increaseTime(216000) //2.5 days
        await mine()
// 
        // await vault.connect(deployer).unlockMigrateFunds()
        await vault.connect(deployer).migrateFunds()
        await vault.connect(unlockedUser).withdraw(shares, 1)
        let afterBalance = await USDC.balanceOf(unlockedUser.address)
// 
        // console.log("Withdrawn", (afterBalance.sub(beforeBalance)).toString())
        // 
    })

})