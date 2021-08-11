const { expect } = require("chai")
const { ethers, deployments, network } = require('hardhat')
const { mainnet: addresses } = require('../../addresses/optionB') //TODO
const IERC20_ABI = require("../../abis/IERC20_ABI.json")//TODO
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace")
const { mnemonicToEntropy } = require("ethers/lib/utils")
const sushiABI = require("../../artifacts/interfaces/IUniswapV2Router02.sol/IUniswapV2Router02.json").abi

const USDTAddress = addresses.TOKENS.USDT
const ALCXAddress = addresses.TOKENS.ALCX
const DAIAddress = addresses.TOKENS.DAI
const unlockedAddress = "0x73faf4Be6cB43489b8f6E8A4ed3CCd804Eb18586"//"0xc247722Ac42B2f9BA752886502c3D3dD39BDb2Da"//addresses.ADDRESSES.unlockedUser
const unlockedAddress2 = "0x96Ba4d04d889426B4B1eb051bf5DAF00Ec331004" //"0xF39d30Fa570db7940e5b3A3e42694665A1449E4B"//addresses.ADDRESSES.unlockedUser2


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


describe("OA - ETHALCX", () => {
    const setup = async () => {
        const [deployer] = await ethers.getSigners()

        const USDT = new ethers.Contract(USDTAddress, IERC20_ABI, deployer)
        const ALCX = new ethers.Contract(ALCXAddress, IERC20_ABI, deployer)
        const DAI = new ethers.Contract(DAIAddress, IERC20_ABI, deployer)
        const SUSHI = new ethers.Contract(addresses.TOKENS.SUSHI, IERC20_ABI, deployer)
        const WETH = new ethers.Contract(addresses.TOKENS.WETH, IERC20_ABI, deployer)

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

        const impl = await ethers.getContract("DAOVaultOptionB", deployer)
        let implArtifacts = await artifacts.readArtifact("DAOVaultOptionB")
        const Factory = await ethers.getContract("SushiOptionAFactory", deployer)
        const vaultProxyAddress = await Factory.getVault((await Factory.totalVaults()).toNumber() - 1)

        const vault = await ethers.getContractAt(implArtifacts.abi, vaultProxyAddress, deployer)

        const unlockedUser = await ethers.getSigner(unlockedAddress)
        const unlockedUser2 = await ethers.getSigner(unlockedAddress2)
        const adminSigner = await ethers.getSigner(addresses.ADDRESSES.adminAddress)

        await USDT.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 6))
        await ALCX.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await DAI.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await WETH.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await WETH.connect(unlockedUser).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        await ALCX.connect(unlockedUser).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        await USDT.connect(unlockedUser).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))

        await USDT.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 6))
        await ALCX.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await DAI.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await WETH.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await WETH.connect(unlockedUser2).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        await ALCX.connect(unlockedUser2).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        await USDT.connect(unlockedUser2).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))

        return { vault, USDT, ALCX, DAI, WETH, unlockedUser, unlockedUser2, adminSigner, deployer, SushiRouter }
    }

    beforeEach(async () => {
        await deployments.fixture(["oa_mainnet_deploy_pool_eth-alcx"])
    })


    it("Should deploy correctly", async () => {
        const { vault, ALCX, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer } = await setup()
        expect(await vault.communityWallet()).to.be.equal(addresses.ADDRESSES.communityWallet)
        expect(await vault.treasuryWallet()).to.be.equal(addresses.ADDRESSES.treasuryWallet)
        expect(await vault.strategist()).to.be.equal(addresses.ADDRESSES.strategist)
        expect(await vault.trustedForwarder()).to.be.equal(addresses.ADDRESSES.trustedForwarder)
        expect(await vault.admin()).to.be.equal(addresses.ADDRESSES.adminAddress)

    })

    it("Should work - normal flow with token1", async () => {
        const { vault, ALCX, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer } = await setup()
        let balanceBefore = await ALCX.balanceOf(unlockedUser.address)
        let balanceBefore2 = await ALCX.balanceOf(unlockedUser2.address)
        console.log(balanceBefore.toString(), balanceBefore2.toString())
        await vault.connect(unlockedUser).deposit(ALCX.address, ethers.utils.parseUnits("100", 18))
        await vault.connect(unlockedUser2).deposit(ALCX.address, ethers.utils.parseUnits("50", 18))

        let shares = await vault.balanceOf(unlockedUser.address)
        let sharesUser2 = await vault.balanceOf(unlockedUser2.address)
        await vault.connect(adminSigner).invest()
        
        await increaseTime(86400)//(432000)
        await mine()

        await vault.connect(adminSigner).yield()

        await vault.connect(unlockedUser).withdraw(ALCX.address, shares)
        await vault.connect(unlockedUser2).withdraw(ALCX.address, sharesUser2)
        let balanceAfter = await ALCX.balanceOf(unlockedUser.address)
        console.log('withdrawn ', (balanceAfter.sub(balanceBefore).toString()), balanceBefore.toString(), balanceAfter.toString())
        let valueInPool = await vault.balance()
        console.log('valueInPool', valueInPool.toString())
        // // 
        let balanceAfter2 = await ALCX.balanceOf(unlockedUser2.address)
        console.log('withdrawn ', (balanceAfter2.sub(balanceBefore2).toString()), balanceBefore2.toString(), balanceAfter2.toString())
        valueInPool = await vault.balance()
        console.log('valueInPool', valueInPool.toString())
    })

    it("Should work - normal flow with token0", async () => {
        const { vault, ALCX, USDT, DAI, WETH, unlockedUser, unlockedUser2, adminSigner, deployer, SushiRouter } = await setup()
        // swap to WETH
        await SushiRouter.connect(unlockedUser).swapExactTokensForTokens(ethers.utils.parseUnits("100", 18), 0, [ALCX.address, WETH.address], unlockedAddress, 32490605417);
        await SushiRouter.connect(unlockedUser2).swapExactTokensForTokens(ethers.utils.parseUnits("100", 18), 0, [ALCX.address, WETH.address], unlockedAddress2, 32490605417);

        let balanceBefore = await WETH.balanceOf(unlockedUser.address)
        let balanceBefore2 = await WETH.balanceOf(unlockedUser2.address)

        await vault.connect(unlockedUser).deposit(WETH.address, balanceBefore)
        await vault.connect(unlockedUser2).deposit(WETH.address, balanceBefore2)

        let shares = await vault.balanceOf(unlockedUser.address)
        let sharesUser2 = await vault.balanceOf(unlockedUser2.address)
        await vault.connect(adminSigner).invest()

        
        await increaseTime(86400)//(432000)
        await mine()

        await vault.connect(adminSigner).yield()

        await vault.connect(unlockedUser).withdraw(WETH.address, shares)
        await vault.connect(unlockedUser2).withdraw(WETH.address, sharesUser2)
        let balanceAfter = await WETH.balanceOf(unlockedUser.address)
        // console.log('withdrawn ', (balanceAfter.sub(balanceBefore).toString()), balanceBefore.toString(), balanceAfter.toString())
        let valueInPool = await vault.balance()
        // console.log('valueInPool', valueInPool.toString())
        // // 
        let balanceAfter2 = await WETH.balanceOf(unlockedUser2.address)
        // console.log('withdrawn ', (balanceAfter2.sub(balanceBefore2).toString()), balanceBefore2.toString(), balanceAfter2.toString())
        valueInPool = await vault.balance()
        // console.log('valueInPool', valueInPool.toString())
    })

    it("Should work - normal flow with ETH", async () => {
        const { vault, ALCX, USDT, DAI, WETH, unlockedUser, unlockedUser2, adminSigner, deployer } = await setup()
        // let balanceBefore = await ALCX.balanceOf(unlockedUser.address)
        // let balanceBefore2 = await ALCX.balanceOf(unlockedUser2.address)
        // 
        await vault.connect(unlockedUser).deposit(ethers.constants.AddressZero, ethers.utils.parseUnits("1", 18), { value: ethers.utils.parseEther("1.0") })
        await vault.connect(unlockedUser2).deposit(ethers.constants.AddressZero, ethers.utils.parseUnits("1", 18), { value: ethers.utils.parseEther("1.0") })
        // 
        let shares = await vault.balanceOf(unlockedUser.address)
        let sharesUser2 = await vault.balanceOf(unlockedUser2.address)
        await vault.connect(adminSigner).invest()
        await increaseTime(86400)//(432000)
        await mine()

        await vault.connect(adminSigner).yield()
        await increaseTime(86400)//(432000)
        await mine()

        await vault.connect(unlockedUser).withdraw(ethers.constants.AddressZero, shares)
        await vault.connect(unlockedUser2).withdraw(ethers.constants.AddressZero, sharesUser2)
        let balanceAfter = await ALCX.balanceOf(unlockedUser.address)
        // console.log('withdrawn ', (balanceAfter.sub(balanceBefore).toString()), balanceBefore.toString(), balanceAfter.toString())
        let valueInPool = await vault.balance()
        // console.log('valueInPool', valueInPool.toString())
        // // 
        // let balanceAfter2 = await ALCX.balanceOf(unlockedUser2.address)
        // console.log('withdrawn ', (balanceAfter2.sub(balanceBefore2).toString()), balanceBefore2.toString(), balanceAfter2.toString())
        valueInPool = await vault.balance()
        // console.log('valueInPool', valueInPool.toString())
    })

    it("Should yield correctly", async () => {//TODO - check
        const { vault, strategy, ALCX, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer } = await setup()
        await vault.connect(unlockedUser).deposit(ALCX.address, ethers.utils.parseUnits("10000", 6))

        await vault.connect(adminSigner).invest()
        await increaseTime(86400)//(432000)
        await vault.connect(unlockedUser2).deposit(ALCX.address, ethers.utils.parseUnits("10000", 6))
        let valueInPoolBefore = await vault.balance()
        await vault.connect(adminSigner).yield()
        let valueInPoolAfter = await vault.balance()

        let shares = await vault.balanceOf(unlockedUser.address)



        // expect(valueInPoolAfter.toNumber()).to.be.greaterThan(valueInPoolBefore.toNumber())
    })

    it("Should withdraw all funds in emergencyWithdraw", async () => {
        const { vault, strategy, ALCX, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer } = await setup()
        await vault.connect(unlockedUser).deposit(ALCX.address, ethers.utils.parseUnits("10000", 6))
        let balanceBefore = await ALCX.balanceOf(unlockedUser.address)

        let shares = await vault.balanceOf(unlockedUser.address)
        await vault.connect(adminSigner).invest()
        await vault.connect(adminSigner).emergencyWithdraw()
        await vault.connect(unlockedUser).withdraw(ALCX.address, shares)
        let balanceAfter = await ALCX.balanceOf(unlockedUser.address)

        console.log("Withdrawn amount",(balanceAfter.sub(balanceBefore)).toString())
    })
    // 
    it("Should revert other functions on emergency", async () => {
        const { vault, strategy, ALCX, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer } = await setup()
        await vault.connect(unlockedUser).deposit(ALCX.address, ethers.utils.parseUnits("10000", 6))
        await vault.connect(adminSigner).invest()
        // 
        await vault.connect(adminSigner).emergencyWithdraw()
        await expect(vault.connect(unlockedUser).deposit(ALCX.address, ethers.utils.parseUnits("10000", 6))).to.be.revertedWith("Deposit paused")
        await expect(vault.connect(adminSigner).invest()).to.be.revertedWith("Invest paused")
        await expect(vault.connect(adminSigner).yield()).to.be.revertedWith("yield paused")
        // 
    })
    // // 
    it("Should enable all functions on reinvest", async () => {
        const { vault, strategy, ALCX, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer } = await setup()
        await vault.connect(unlockedUser).deposit(ALCX.address, ethers.utils.parseUnits("100", 18))
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