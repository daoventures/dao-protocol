const { ethers } = require("hardhat")
const IERC20_ABI = require("../abis/IERC20_ABI.json")

const WETHAddr = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"

const AXSETHAddr = "0x0C365789DbBb94A29F8720dc465554c587e897dB"
const SLPETHAddr = "0x8597fa0773888107E2867D36dd87Fe5bAFeAb328"
const ILVETHAddr = "0x6a091a3406E0073C3CD6340122143009aDac0EDa"
const GHSTETHAddr = "0xaB659deE3030602c1aF8C29D146fAcD4aeD6EC85"
const REVVETHAddr = "0xc926990039045611eb1DE520C1E249Fd0d20a8eA"
const MVIAddr = "0x72e364F2ABdC788b7E918bc238B21f109Cd634D7"

const sushiFarmAddr = "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd"
const illuviumAddr = "0x8B4d8443a0229349A9892D4F7CbE89eF5f843F72"

describe("Metaverse-Farmer", () => {
    it("should work", async () => {
        const [deployer] = await ethers.getSigners()
        const MVFFactory = await ethers.getContractFactory("MVFStrategy")
        const mvfStrategy = await MVFFactory.deploy()

        let WETHContract
        WETHContract = new ethers.Contract(WETHAddr, ["function deposit() external payable"], deployer)
        await WETHContract.deposit({value: ethers.utils.parseEther("5")})
        WETHContract = new ethers.Contract(WETHAddr, IERC20_ABI, deployer)
        await mvfStrategy.initialize()
        await WETHContract.approve(mvfStrategy.address, ethers.constants.MaxUint256)
        await mvfStrategy.invest(WETHContract.balanceOf(deployer.address))

        const abi = ["function balanceOf(address) external view returns (uint)", "function userInfo(uint, address) external view returns (uint)"]
        const AXSETHContract = new ethers.Contract(AXSETHAddr, abi, deployer)
        const sushiFarmContract = new ethers.Contract(sushiFarmAddr, abi, deployer)
        const SLPETHContract = new ethers.Contract(SLPETHAddr, abi, deployer)
        const ILVETHContract = new ethers.Contract(ILVETHAddr, abi, deployer)
        const illuviumContract = new ethers.Contract(illuviumAddr, abi, deployer)
        const GHSTETHContract = new ethers.Contract(GHSTETHAddr, abi, deployer)
        const REVVETHContract = new ethers.Contract(REVVETHAddr, abi, deployer)
        const MVIContract = new ethers.Contract(MVIAddr, abi, deployer)
        console.log(ethers.utils.formatEther(await AXSETHContract.balanceOf(mvfStrategy.address)))
        console.log(ethers.utils.formatEther(await sushiFarmContract.userInfo(231, mvfStrategy.address)))
        console.log(ethers.utils.formatEther(await SLPETHContract.balanceOf(mvfStrategy.address)))
        console.log(ethers.utils.formatEther(await ILVETHContract.balanceOf(mvfStrategy.address)))
        console.log(ethers.utils.formatEther(await illuviumContract.balanceOf(mvfStrategy.address)))
        console.log(ethers.utils.formatEther(await GHSTETHContract.balanceOf(mvfStrategy.address)))
        console.log(ethers.utils.formatEther(await REVVETHContract.balanceOf(mvfStrategy.address)))
        console.log(ethers.utils.formatEther(await MVIContract.balanceOf(mvfStrategy.address)))
    })
})