const { expect } = require("chai")
const { ethers, deployments, network, tenderly } = require('hardhat') //AdJZ3e23bkbhEcllCeWU4XRr7GyXPE3M
const { mainnet: addresses } = require('../../addresses/uniL1') //TODO
const IERC20_ABI = require("../../abis/IERC20_ABI.json")//TODO
const positionManagerABI = require('../../artifacts/@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json').abi

const WETHAddress = addresses.TOKENS.WETH
const GHSTAddress = addresses.TOKENS.GHST// "0xcc8fa225d80b9c7d42f96e9570156c65d6caaa25"
const positionMangerAddr = addresses.UNI.NFTPositionManager //"0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
const unlockedAddress = "0xE75021660E00A7FA0DF1B97da13eBAbe6D82e7ea"//"0x3bd8d39dea92e31Cf583177fE48BC8AB8a791959"//"0xdE63FA9aCEe008d55d676196CCf665Aeb3A6A596"//addresses.ADDRESSES.unlockedUser
const unlockedAddress2 = "0x4185fA0abcDE874F56d643F70158A684fb9FB22E"//addresses.ADDRESSES.unlockedUser2
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
    const GHST = new ethers.Contract(GHSTAddress, IERC20_ABI, deployer)
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

    await GHST.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
    await WETH.connect(unlockedUser).approve(vault.address, ethers.utils.parseUnits("1000", 18))

    await GHST.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000000000", 18))
    await WETH.connect(unlockedUser2).approve(vault.address, ethers.utils.parseUnits("1000", 18))

    return { GHST, WETH, PositionManager, vault, unlockedUser, unlockedUser2, deployer, admin }

}

describe("UNI - GHST_ETH", async () => {

    beforeEach(async () => {
        await deployments.fixture(["uni_mainnet_deploy_GHST_ETH_pool"])
    })

    it("Should work - normal flow", async () => {
        let { GHST, WETH, PositionManager, vault, unlockedUser, unlockedUser2, deployer, admin } = await setup()


        await vault.connect(unlockedUser).deposit(ethers.utils.parseEther("24000"), ethers.utils.parseEther("3"))
        // console.log('shares1', (await vault.balanceOf(unlockedAddress)).toString())

        await vault.connect(unlockedUser2).deposit(ethers.utils.parseEther("24000"), ethers.utils.parseEther("3"))
        // console.log('shares2', (await vault.balanceOf(unlockedAddress2)).toString())


        await vault.connect(unlockedUser).withdraw(await vault.balanceOf(unlockedUser.address))

        await vault.connect(admin).yield()
    })

    it("should change ticker correctly", async () => {
        let { GHST, WETH, PositionManager, vault, unlockedUser, unlockedUser2, deployer, admin } = await setup()
        await vault.connect(unlockedUser).deposit(ethers.utils.parseEther("24000"), ethers.utils.parseEther("3"))

        await vault.connect(admin).changeTicks(840000, -840000)
    })

})