const { expect } = require("chai")
const { ethers, deployments, network, tenderly } = require('hardhat') //AdJZ3e23bkbhEcllCeWU4XRr7GyXPE3M
const { mainnet: addresses } = require('../../addresses/uniL1') //TODO
const IERC20_ABI = require("../../abis/IERC20_ABI.json")//TODO
const positionManagerABI = require('../../artifacts/@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json').abi

const WETHAddress = addresses.TOKENS.WETH
const SLPAddress = addresses.TOKENS.SLP// "0xcc8fa225d80b9c7d42f96e9570156c65d6caaa25"
const positionMangerAddr = addresses.UNI.NFTPositionManager //"0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
const unlockedAddress = "0x7A38ab33655898E9b877cFEA17668298CFDe772d"//"0x3bd8d39dea92e31Cf583177fE48BC8AB8a791959"//"0xdE63FA9aCEe008d55d676196CCf665Aeb3A6A596"//addresses.ADDRESSES.unlockedUser
const unlockedAddress2 = "0x720a9307d04B33445FeC244DC3B73B847D7fE8B7"//addresses.ADDRESSES.unlockedUser2
const deployerAddress = "0x229b5c097F9b35009CA1321Ad2034D4b3D5070F6"
const tokenId = 114014 //102494	

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

const setup = async () => {
    const [deployer] = await ethers.getSigners()

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

    const unlockedUser = await ethers.getSigner(unlockedAddress)
    const unlockedUser2 = await ethers.getSigner(unlockedAddress2)
    const admin = await ethers.getSigner(addresses.ADDRESSES.adminAddress)

    const WETH = new ethers.Contract(WETHAddress, IERC20_ABI, deployer)
    const SLP = new ethers.Contract(SLPAddress, IERC20_ABI, deployer)
    const PositionManager = new ethers.Contract(positionMangerAddr, positionManagerABI, deployer)

    const impl = await ethers.getContract("uniVault", deployer)
    let implArtifacts = await artifacts.readArtifact("uniVault")

    const Factory = await ethers.getContract("uniVaultFactory", deployer)
    const vaultProxyAddress = await Factory.getVault((await Factory.totalVaults()).toNumber() - 1)

    const vault = await ethers.getContractAt(implArtifacts.abi, vaultProxyAddress, deployer)

    //TOPUP
    await deployer.sendTransaction({ to: unlockedAddress, value: ethers.utils.parseUnits("50", 18) })
    await deployer.sendTransaction({ to: unlockedAddress2, value: ethers.utils.parseUnits("5", 18) })
    await deployer.sendTransaction({ to: admin.address, value: ethers.utils.parseUnits("5", 18) })

    await unlockedUser.sendTransaction({ to: WETHAddress, value: ethers.utils.parseUnits("10", 18) })
    await unlockedUser2.sendTransaction({ to: WETHAddress, value: ethers.utils.parseUnits("4", 18) })

    await SLP.connect(unlockedUser).approve(vault.address, "10000000")
    await WETH.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000", 18))

    await SLP.connect(unlockedUser2).approve(vault.address, "10000000")
    await WETH.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000", 18))

    return { SLP, WETH, PositionManager, vault, unlockedUser, unlockedUser2, deployer, admin }

}

describe("UNI - SLP_ETH", async () => {

    beforeEach(async () => {
        await deployments.fixture(["uni_mainnet_deploy_pool"])
    })

    it("Should work - normal flow", async () => {
        let { SLP, WETH, PositionManager, vault, unlockedUser, unlockedUser2, deployer, admin } = await setup()


        let tx = await vault.connect(unlockedUser).deposit(ethers.utils.parseEther("1"), "25333")
        let result = await tx.wait()
        console.log('gasUsed', result.gasUsed.toString())
        // console.log('shares1', (await vault.balanceOf(unlockedAddress)).toString())

        tx = await vault.connect(unlockedUser2).deposit(ethers.utils.parseEther("0.01"), "23300")
        result = await tx.wait()
        console.log('gasUsed', result.gasUsed.toString())
        // console.log('shares2', (await vault.balanceOf(unlockedAddress2)).toString())


        await vault.connect(unlockedUser).withdraw(await vault.balanceOf(unlockedUser.address))

        await vault.connect(admin).yield()
    })

    it("should change ticker correctly", async () => {
        let { SLP, WETH, PositionManager, vault, unlockedUser, unlockedUser2, deployer, admin } = await setup()
        await vault.connect(unlockedUser).deposit(ethers.utils.parseEther("1"), "25333")

        await vault.connect(admin).changeTicks(840000, -840000)
    })

    it("Should transfer fee correctly", async () => {
        let { SLP, WETH, PositionManager, vault, unlockedUser, unlockedUser2, deployer, admin } = await setup()

        let strategistBalanceBefore0 = await WETH.balanceOf(addresses.ADDRESSES.strategist)
        let communityWalletBalanceBefore0 = await WETH.balanceOf(addresses.ADDRESSES.communityWallet)
        let treasuryBalanceBefore0 = await WETH.balanceOf(addresses.ADDRESSES.treasuryWallet)

        let strategistBalanceBefore1 = await SLP.balanceOf(addresses.ADDRESSES.strategist)
        let communityWalletBalanceBefore1 = await SLP.balanceOf(addresses.ADDRESSES.communityWallet)
        let treasuryBalanceBefore1 = await SLP.balanceOf(addresses.ADDRESSES.treasuryWallet)

        await vault.connect(unlockedUser).deposit(ethers.utils.parseEther("1"), "25333")
        await vault.connect(admin).transferFee()

        let two_Percent0 = ethers.utils.parseEther("1").mul(2).div(100)

        let strategistBalanceAfter0 = await WETH.balanceOf(addresses.ADDRESSES.strategist)
        let communityWalletBalanceAfter0 = await WETH.balanceOf(addresses.ADDRESSES.communityWallet)
        let treasuryBalanceAfter0 = await WETH.balanceOf(addresses.ADDRESSES.treasuryWallet)

        let strategistBalanceAfter1 = await SLP.balanceOf(addresses.ADDRESSES.strategist)
        let communityWalletBalanceAfter1 = await SLP.balanceOf(addresses.ADDRESSES.communityWallet)
        let treasuryBalanceAfter1 = await SLP.balanceOf(addresses.ADDRESSES.treasuryWallet)

        expect(strategistBalanceAfter0.sub(strategistBalanceBefore0)).to.be.equal(two_Percent0.div(2));
    })

})