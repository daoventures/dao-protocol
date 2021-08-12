const { expect } = require("chai")
const { ethers, deployments, network } = require('hardhat')
const { mainnet: addresses } = require('../../addresses/optionA') //TODO
const IERC20_ABI = require("../../abis/IERC20_ABI.json")//TODO
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace")
const { mnemonicToEntropy } = require("ethers/lib/utils")
const sushiABI = require("../../artifacts/interfaces/IUniswapV2Router02.sol/IUniswapV2Router02.json").abi

const USDTAddress = addresses.TOKENS.USDT
const BTCAddress = addresses.TOKENS.WBTC
const DAIAddress = addresses.TOKENS.DAI
const IBTCAddress = addresses.TOKENS.IBTC
const unlockedAddress = "0xFC686BB7F423Ba8f6a16b0Dd32405A30505A8C1b"//"0xc247722Ac42B2f9BA752886502c3D3dD39BDb2Da"//addresses.ADDRESSES.unlockedUser
const unlockedAddress2 = "0x88884e35d7006AE84EfEf09ee6BC6A43DD8E2BB8" //"0xF39d30Fa570db7940e5b3A3e42694665A1449E4B"//addresses.ADDRESSES.unlockedUser2


const increaseTime = async (_timeInMilliSeconds) => {
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


describe("OA - WBTCibBTC", () => {
    const setup = async () => {
        const [deployer] = await ethers.getSigners()

        const USDT = new ethers.Contract(USDTAddress, IERC20_ABI, deployer)
        const WBTC = new ethers.Contract(BTCAddress, IERC20_ABI, deployer)
        const DAI = new ethers.Contract(DAIAddress, IERC20_ABI, deployer)
        const SUSHI = new ethers.Contract(addresses.TOKENS.SUSHI, IERC20_ABI, deployer)
        const IBTC = new ethers.Contract(IBTCAddress, IERC20_ABI, deployer)

        const SushiRouter = await ethers.getContractAt(sushiABI, addresses.SUSHI.router, deployer)

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

        const impl = await ethers.getContract("DAOVaultOptionA", deployer)
        let implArtifacts = await artifacts.readArtifact("DAOVaultOptionA")
        const Factory = await ethers.getContract("SushiOptionAFactory", deployer)
        const vaultProxyAddress = await Factory.getVault((await Factory.totalVaults()).toNumber() - 1)

        const vault = await ethers.getContractAt(implArtifacts.abi, vaultProxyAddress, deployer)

        const unlockedUser = await ethers.getSigner(unlockedAddress)
        const unlockedUser2 = await ethers.getSigner(unlockedAddress2)
        const adminSigner = await ethers.getSigner(addresses.ADDRESSES.adminAddress)
        
        // await USDT.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 6))
        await WBTC.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await DAI.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await IBTC.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await IBTC.connect(unlockedUser).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        await WBTC.connect(unlockedUser).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        // await USDT.connect(unlockedUser).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))

        // await USDT.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 6))
        await WBTC.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await DAI.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await IBTC.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await IBTC.connect(unlockedUser2).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        await WBTC.connect(unlockedUser2).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        // await USDT.connect(unlockedUser2).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))

        return { vault, USDT, WBTC, DAI, IBTC, unlockedUser, unlockedUser2, adminSigner, deployer, SushiRouter }
    }

    beforeEach(async () => {
        await deployments.fixture(["oa_mainnet_deploy_pool_wbtc-ibtc"])
    })


    it("Should deploy correctly", async () => {
        const { vault, WBTC, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer } = await setup()
        expect(await vault.communityWallet()).to.be.equal(addresses.ADDRESSES.communityWallet)
        expect(await vault.treasuryWallet()).to.be.equal(addresses.ADDRESSES.treasuryWallet)
        expect(await vault.strategist()).to.be.equal(addresses.ADDRESSES.strategist)
        expect(await vault.trustedForwarder()).to.be.equal(addresses.ADDRESSES.trustedForwarder)
        expect(await vault.admin()).to.be.equal(addresses.ADDRESSES.adminAddress)

    })

    it("Should work - normal flow with token1", async () => {
        const { vault, WBTC, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer } = await setup()
        let balanceBefore = await WBTC.balanceOf(unlockedUser.address)
        let balanceBefore2 = await WBTC.balanceOf(unlockedUser2.address)
        console.log(balanceBefore.toString(), balanceBefore2.toString())
        await vault.connect(unlockedUser).deposit(WBTC.address, ethers.utils.parseUnits("2", 8))
        await vault.connect(unlockedUser2).deposit(WBTC.address, ethers.utils.parseUnits("1", 8))
        console.log('after deposit')
        let shares = await vault.balanceOf(unlockedUser.address)
        let sharesUser2 = await vault.balanceOf(unlockedUser2.address)
        await vault.connect(adminSigner).invest()
        console.log('after invest')
        await increaseTime(86400)//(432000)
        await mine()

        await vault.connect(adminSigner).yield()
        
        await vault.connect(unlockedUser).withdraw(WBTC.address, shares)
        await vault.connect(unlockedUser2).withdraw(WBTC.address, sharesUser2)
        let balanceAfter = await WBTC.balanceOf(unlockedUser.address)
        console.log('withdrawn ', (balanceAfter.sub(balanceBefore).toString()), balanceBefore.toString(), balanceAfter.toString())
        let valueInPool = await vault.balance()
        console.log('valueInPool', valueInPool.toString())
        // // 
        let balanceAfter2 = await WBTC.balanceOf(unlockedUser2.address)
        console.log('withdrawn ', (balanceAfter2.sub(balanceBefore2).toString()), balanceBefore2.toString(), balanceAfter2.toString())
        valueInPool = await vault.balance()
        console.log('valueInPool', valueInPool.toString())
    })

    it("Should work - normal flow with token0", async () => {
        const { vault, WBTC, USDT, DAI, IBTC, unlockedUser, unlockedUser2, adminSigner, deployer, SushiRouter } = await setup()
        // swap to IBTC
        await SushiRouter.connect(unlockedUser).swapExactTokensForTokens(ethers.utils.parseUnits("1", 8), 0, [WBTC.address, IBTC.address], unlockedAddress, 32490605417);
        await SushiRouter.connect(unlockedUser2).swapExactTokensForTokens(ethers.utils.parseUnits("1", 8), 0, [WBTC.address, IBTC.address], unlockedAddress2, 32490605417);

        let balanceBefore = await IBTC.balanceOf(unlockedUser.address)
        let balanceBefore2 = await IBTC.balanceOf(unlockedUser2.address)

        await vault.connect(unlockedUser).deposit(IBTC.address, balanceBefore)
        await vault.connect(unlockedUser2).deposit(IBTC.address, balanceBefore2)

        let shares = await vault.balanceOf(unlockedUser.address)
        let sharesUser2 = await vault.balanceOf(unlockedUser2.address)
        await vault.connect(adminSigner).invest()

        
        await increaseTime(86400)//(432000)
        await mine()

        await vault.connect(adminSigner).yield()

        await vault.connect(unlockedUser).withdraw(IBTC.address, shares)
        await vault.connect(unlockedUser2).withdraw(IBTC.address, sharesUser2)
        let balanceAfter = await IBTC.balanceOf(unlockedUser.address)
        // console.log('withdrawn ', (balanceAfter.sub(balanceBefore).toString()), balanceBefore.toString(), balanceAfter.toString())
        let valueInPool = await vault.balance()
        // console.log('valueInPool', valueInPool.toString())
        // // 
        let balanceAfter2 = await IBTC.balanceOf(unlockedUser2.address)
        // console.log('withdrawn ', (balanceAfter2.sub(balanceBefore2).toString()), balanceBefore2.toString(), balanceAfter2.toString())
        valueInPool = await vault.balance()
        // console.log('valueInPool', valueInPool.toString())
    })

    it("Should yield correctly", async () => {//TODO - check
        const { vault, strategy, WBTC, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer } = await setup()
        await vault.connect(unlockedUser).deposit(WBTC.address, ethers.utils.parseUnits("1", 8))

        await vault.connect(adminSigner).invest()
        await increaseTime(86400)//(432000)
        await vault.connect(unlockedUser2).deposit(WBTC.address, ethers.utils.parseUnits("2", 8))
        await vault.connect(adminSigner).invest()
        let valueInPoolBefore = await vault.balance()
        await vault.connect(adminSigner).yield()
        let valueInPoolAfter = await vault.balance()

        let shares = await vault.balanceOf(unlockedUser.address)



        // expect(valueInPoolAfter.toNumber()).to.be.greaterThan(valueInPoolBefore.toNumber())
    })

    it("Should withdraw all funds in emergencyWithdraw", async () => {
        const { vault, strategy, WBTC, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer } = await setup()
        await vault.connect(unlockedUser).deposit(WBTC.address, ethers.utils.parseUnits("1", 8))
        let balanceBefore = await WBTC.balanceOf(unlockedUser.address)

        let shares = await vault.balanceOf(unlockedUser.address)
        await vault.connect(adminSigner).invest()
        await vault.connect(adminSigner).emergencyWithdraw()
        await vault.connect(unlockedUser).withdraw(WBTC.address, shares)
        let balanceAfter = await WBTC.balanceOf(unlockedUser.address)

        console.log("Withdrawn amount",(balanceAfter.sub(balanceBefore)).toString())
    })
    // 
    it("Should revert other functions on emergency", async () => {
        const { vault, strategy, WBTC, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer } = await setup()
        await vault.connect(unlockedUser).deposit(WBTC.address, ethers.utils.parseUnits("1", 8))
        await vault.connect(adminSigner).invest()
        // 
        await vault.connect(adminSigner).emergencyWithdraw()
        await expect(vault.connect(unlockedUser).deposit(WBTC.address, ethers.utils.parseUnits("1", 8))).to.be.revertedWith("Deposit paused")
        await expect(vault.connect(adminSigner).invest()).to.be.revertedWith("Invest paused")
        await expect(vault.connect(adminSigner).yield()).to.be.revertedWith("yield paused")
        // 
    })
    // 
    it("Should enable all functions on reinvest", async () => {
        const { vault, strategy, WBTC, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer } = await setup()
        await vault.connect(unlockedUser).deposit(WBTC.address, ethers.utils.parseUnits("1", 8))
        await vault.connect(adminSigner).invest()
        await vault.connect(unlockedUser2).deposit(WBTC.address, ethers.utils.parseUnits("2", 8))
        await vault.connect(adminSigner).invest()
        await vault.connect(adminSigner).yield()
        await vault.connect(adminSigner).emergencyWithdraw()
        // 
        await vault.connect(deployer).reInvest()

        // console.log('beforeInvest')
        await vault.connect(adminSigner).invest()
        // console.log('beforeYield')
        await vault.connect(adminSigner).yield()
    })

})