const { expect } = require("chai")
const { ethers, deployments, network } = require('hardhat')
const { mainnet: addresses } = require('../../addresses/optionA') //TODO
const IERC20_ABI = require("../../abis/IERC20_ABI.json")//TODO
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace")
const sushiABI = require("../../artifacts/interfaces/IUniswapV2Router02.sol/IUniswapV2Router02.json").abi

const USDTAddress = addresses.TOKENS.USDT
const WBTCAddress = addresses.TOKENS.WBTC
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
    let result = await network.provider.request({
        method: "evm_mine",
        params: []
    })
}
describe("OA - ETHWBTC", () => {
    const setup = async () => {
        const [deployer] = await ethers.getSigners()

        const USDT = new ethers.Contract(USDTAddress, IERC20_ABI, deployer)
        const WBTC = new ethers.Contract(WBTCAddress, IERC20_ABI, deployer)
        const DAI = new ethers.Contract(DAIAddress, IERC20_ABI, deployer)
        const SUSHI = new ethers.Contract(addresses.TOKENS.SUSHI, IERC20_ABI, deployer)
        const IBTC = new ethers.Contract(addresses.TOKENS.IBTC, IERC20_ABI, deployer)
        const lpToken = new ethers.Contract(addresses.TOKENS.WBTCIBTCLP, IERC20_ABI, deployer)

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
        await WBTC.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 6))
        await DAI.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await IBTC.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await IBTC.connect(unlockedUser).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        await WBTC.connect(unlockedUser).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        // await USDT.connect(unlockedUser).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        await lpToken.connect(unlockedUser).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        await lpToken.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))

        // await USDT.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 6))
        await WBTC.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 6))
        await DAI.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await IBTC.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
        await IBTC.connect(unlockedUser2).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        await WBTC.connect(unlockedUser2).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        // await USDT.connect(unlockedUser2).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        await lpToken.connect(unlockedUser2).approve(SushiRouter.address, ethers.utils.parseUnits("1000000000", 18))
        await lpToken.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))

        return { vault, USDT, WBTC, DAI, IBTC, lpToken, unlockedUser, unlockedUser2, adminSigner, deployer, SushiRouter }
    }

    beforeEach(async () => {
        await deployments.fixture(["oa_mainnet_deploy_pool_wbtc-ibtc"])
    })


    it("Should deploy correctly", async () => {
        const { vault, WBTC, USDT, DAI, unlockedUser, unlockedUser2, adminSigner, deployer } = await setup()
        expect(await vault.communityWallet()).to.be.equal(addresses.ADDRESSES.communityWallet)
        expect(await vault.treasuryWallet()).to.be.equal(addresses.ADDRESSES.treasuryWallet)
        expect(await vault.strategist()).to.be.equal(addresses.ADDRESSES.strategist)
        expect(await vault.admin()).to.be.equal(addresses.ADDRESSES.adminAddress)

    })

    it("should work - normal flow", async () => {
        const { vault, WBTC, USDT, DAI, IBTC, lpToken, unlockedUser, unlockedUser2, adminSigner, deployer, SushiRouter } = await setup()
        await SushiRouter.connect(unlockedUser).swapExactTokensForTokens(ethers.utils.parseUnits("1", 8), 0, [WBTC.address, IBTC.address], unlockedAddress, 32490605417);
        // console.log((await IBTC.balanceOf(unlockedUser.address)).toString())
        await SushiRouter.connect(unlockedUser).addLiquidity(WBTC.address, IBTC.address, ethers.utils.parseUnits("1", 8), ethers.utils.parseUnits("1", 18), 0, 0, unlockedAddress, 32490605417);

        await SushiRouter.connect(unlockedUser2).swapExactTokensForTokens(ethers.utils.parseUnits("2", 8), 0, [WBTC.address, IBTC.address], unlockedAddress2, 32490605417);
        await SushiRouter.connect(unlockedUser2).addLiquidity(WBTC.address, IBTC.address, ethers.utils.parseUnits("1", 8), ethers.utils.parseUnits("1", 18), 0, 0, unlockedAddress2, 32490605417);

        let user1Balance = await lpToken.balanceOf(unlockedAddress);
        let user2Balance = await lpToken.balanceOf(unlockedAddress2);
        // console.log(user1Balance.toString(), user2Balance.toString())
        await vault.connect(unlockedUser).deposit(user1Balance)
        await vault.connect(unlockedUser2).deposit(user2Balance)

        let shares = await vault.balanceOf(unlockedUser.address)
        let sharesUser2 = await vault.balanceOf(unlockedUser2.address)

        // console.log(shares.toString(), sharesUser2.toString())

        await vault.connect(adminSigner).invest()

        await increaseTime(84000)
        await vault.connect(adminSigner).yield()

        await vault.connect(unlockedUser).withdraw(shares)
        await vault.connect(unlockedUser2).withdraw(sharesUser2)

        user1Balance = await lpToken.balanceOf(unlockedAddress);
        user2Balance = await lpToken.balanceOf(unlockedAddress2);
        // console.log(user1Balance.toString(), user2Balance.toString())

    })

    it("Should yield correctly", async () => {
        const { vault, strategy, WBTC, USDT, IBTC, lpToken, unlockedUser, unlockedUser2, adminSigner, deployer, SushiRouter } = await setup()
        await SushiRouter.connect(unlockedUser).swapExactTokensForTokens(ethers.utils.parseUnits("1", 8), 0, [WBTC.address, IBTC.address], unlockedAddress, 32490605417);
        await SushiRouter.connect(unlockedUser).addLiquidity(WBTC.address, IBTC.address, ethers.utils.parseUnits("1", 8), ethers.utils.parseUnits("1", 18), 0, 0, unlockedAddress, 32490605417);
        await SushiRouter.connect(unlockedUser2).swapExactTokensForTokens(ethers.utils.parseUnits("2", 8), 0, [WBTC.address, IBTC.address], unlockedAddress2, 32490605417);
        console.log((await WBTC.balanceOf(unlockedUser2.address)).toString())
        await SushiRouter.connect(unlockedUser2).addLiquidity(WBTC.address, IBTC.address, ethers.utils.parseUnits("1", 8), ethers.utils.parseUnits("1", 18), 0, 0, unlockedAddress2, 32490605417);
        let user1Balance = await lpToken.balanceOf(unlockedAddress);
        let user2Balance = await lpToken.balanceOf(unlockedAddress2);

        await vault.connect(unlockedUser).deposit(user1Balance)
        await vault.connect(unlockedUser2).deposit(user2Balance)

        await vault.connect(adminSigner).invest()
        await increaseTime(86400)//(432000)
        await mine()
        let valueInPoolBefore = await vault.balance()
        await vault.connect(adminSigner).yield()
        let valueInPoolAfter = await vault.balance()

        expect(valueInPoolAfter.toNumber()).to.be.greaterThan(valueInPoolBefore.toNumber())
    })

    it("Should withdraw all funds in emergencyWithdraw", async () => {
        const { vault, strategy, WBTC, USDT, IBTC, lpToken, unlockedUser, unlockedUser2, adminSigner, deployer, SushiRouter } = await setup()
        await SushiRouter.connect(unlockedUser).swapExactTokensForTokens(ethers.utils.parseUnits("1", 8), 0, [WBTC.address, IBTC.address], unlockedAddress, 32490605417);
        await SushiRouter.connect(unlockedUser).addLiquidity(WBTC.address, IBTC.address, ethers.utils.parseUnits("1", 8), ethers.utils.parseUnits("1", 18), 0, 0, unlockedAddress, 32490605417);

        await SushiRouter.connect(unlockedUser2).swapExactTokensForTokens(ethers.utils.parseUnits("2", 8), 0, [WBTC.address, IBTC.address], unlockedAddress2, 32490605417);
        await SushiRouter.connect(unlockedUser2).addLiquidity(WBTC.address, IBTC.address, ethers.utils.parseUnits("1", 8), ethers.utils.parseUnits("1", 18), 0, 0, unlockedAddress2, 32490605417);

        let user1Balance = await lpToken.balanceOf(unlockedAddress);
        let user2Balance = await lpToken.balanceOf(unlockedAddress2);

        await vault.connect(unlockedUser).deposit(user1Balance)
        await vault.connect(unlockedUser2).deposit(user2Balance)

        let shares = await vault.balanceOf(unlockedUser.address)
        await vault.connect(adminSigner).invest()
        await vault.connect(adminSigner).emergencyWithdraw()
        await vault.connect(unlockedUser).withdraw(shares)
        let balanceAfter = await lpToken.balanceOf(unlockedAddress);
        // console.log(balanceAfter.toString(), user1Balance.toString());
        // console.log("Withdrawn amount", (balanceAfter.sub(user1Balance)).toString())
    })
    // // 
    it("Should revert other functions on emergency", async () => {
        const { vault, strategy, WBTC, USDT, IBTC, lpToken, unlockedUser, unlockedUser2, adminSigner, deployer, SushiRouter } = await setup()
        await SushiRouter.connect(unlockedUser).swapExactTokensForTokens(ethers.utils.parseUnits("1", 8), 0, [WBTC.address, IBTC.address], unlockedAddress, 32490605417);
        await SushiRouter.connect(unlockedUser).addLiquidity(WBTC.address, IBTC.address, ethers.utils.parseUnits("1", 8), ethers.utils.parseUnits("1", 18), 0, 0, unlockedAddress, 32490605417);

        let user1Balance = await lpToken.balanceOf(unlockedAddress);
        await vault.connect(unlockedUser).deposit(user1Balance)

        await vault.connect(adminSigner).invest()
        // 
        await vault.connect(adminSigner).emergencyWithdraw()
        await expect(vault.connect(unlockedUser).deposit(ethers.utils.parseUnits("10000", 18))).to.be.revertedWith("Deposit paused")
        await expect(vault.connect(adminSigner).invest()).to.be.revertedWith("Invest paused")
        await expect(vault.connect(adminSigner).yield()).to.be.revertedWith("yield paused")
        // 
    })

    it("Should enable all functions on reinvest", async () => {
        const { vault, strategy, WBTC, USDT, IBTC, lpToken, unlockedUser, unlockedUser2, adminSigner, deployer, SushiRouter } = await setup()
        await SushiRouter.connect(unlockedUser).swapExactTokensForTokens(ethers.utils.parseUnits("1", 8), 0, [WBTC.address, IBTC.address], unlockedAddress, 32490605417);
        await SushiRouter.connect(unlockedUser).addLiquidity(WBTC.address, IBTC.address, ethers.utils.parseUnits("1", 8), ethers.utils.parseUnits("1", 18), 0, 0, unlockedAddress, 32490605417);

        let user1Balance = await lpToken.balanceOf(unlockedAddress);
        await vault.connect(unlockedUser).deposit(user1Balance)
        await vault.connect(adminSigner).invest()
        await increaseTime(172800)//(432000)
        await mine()
        await vault.connect(adminSigner).emergencyWithdraw()
        // 
        await vault.connect(deployer).reInvest()

        // console.log('beforeInvest')
        await vault.connect(adminSigner).invest()
        // console.log('beforeYield')
        await vault.connect(adminSigner).yield()
    })

})