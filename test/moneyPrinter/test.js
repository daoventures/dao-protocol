const { expect } = require("chai")
const { ethers, deployment, network } = require("hardhat")
const { mainnet: network_ } = require("../../addresses/compound_farmer")
const IERC20_ABI = require("../../abis/IERC20_ABI.json")
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace")
require("dotenv").config()

const USDTAddress = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f"
const USDCAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
const DAIAddress = "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063"
const WETHAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const unlockedAddress = "0x986a2fca9eda0e06fbf7839b89bfc006ee2a23dd" //"0x16463c0fdB6BA9618909F5b120ea1581618C1b9E"
const unlockedAddress2 = "0xDe6b2a06407575B98724818445178C1f5fD53361"

const decimals = (amount) => {
    return ethers.utils.parseUnits(amount.toString(), 18) // Change this to meet token decimals
}


describe("moneyPrinter-USDC", () => {
    
    const getBlockNumber = async ()=> {
        let result = await network.provider.request({
            method: "eth_blockNumber"
        })

        console.log("Block Number: ", String(result))
    }

    const increaseTime = async (_timeInMilliSeconds)=> {
        let result = await network.provider.request({
            method: "evm_increaseTime",
            params: [_timeInMilliSeconds]
        })
    }

    const mine = async (_timeInMilliSeconds)=> {
        let result = await network.provider.request({
            method: "evm_mine",
            params: []
        })
    }
    
    
    const setup = async () => {
        await getBlockNumber()
        const [deployer, treasury, admin] = await ethers.getSigners()

        const USDT = new ethers.Contract(USDTAddress, IERC20_ABI, deployer)
        const USDC = new ethers.Contract(USDCAddress, IERC20_ABI, deployer)
        const DAI = new ethers.Contract(DAIAddress, IERC20_ABI, deployer)
        await getBlockNumber()
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [unlockedAddress]
        })


        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [unlockedAddress2]
        })

        

        const strategy = await ethers.getContractFactory("moneyPrinterStrategy", deployer) //weight, massettoken, unipool, lptoken
        const moneyPrinterStrategy = await strategy.deploy(admin.address)
        await getBlockNumber()

        const vault = await ethers.getContractFactory("moneyPrinterVault", deployer)
        const moneyPrinterVault = await vault.deploy(moneyPrinterStrategy.address, admin.address);
        await moneyPrinterStrategy.connect(admin).setVault(moneyPrinterVault.address)
        await getBlockNumber()
        
        console.log('moneyPrinterVault.address', moneyPrinterVault.address)
        const unlockedUser = await ethers.getSigner(unlockedAddress)
        const unlockedUser2 = await ethers.getSigner(unlockedAddress2)
        await USDT.connect(unlockedUser).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 6))
        await USDC.connect(unlockedUser).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 6))
        await DAI.connect(unlockedUser).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 18))

        await USDT.connect(unlockedUser2).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 6))
        await USDC.connect(unlockedUser2).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 6))
        await DAI.connect(unlockedUser2).approve(moneyPrinterVault.address, ethers.utils.parseUnits("1000000000", 18))
        return { moneyPrinterVault, moneyPrinterStrategy, USDT, USDC, DAI, treasury, deployer, unlockedUser, admin, unlockedUser2/* sampleContract */ }
    }


    it("should work correctly with USDC", async () => {
        const { moneyPrinterVault, moneyPrinterStrategy, USDT, USDC, DAI, treasury, deployer, unlockedUser, admin, unlockedUser2 } = await setup()
        let sharesBefore = await moneyPrinterVault.balanceOf(unlockedUser.address)
        let tx = await moneyPrinterVault.connect(unlockedUser).deposit(ethers.utils.parseUnits("100", 6), USDC.address)
        await increaseTime(3600000)
        let receipt = await tx.wait()
        await getBlockNumber()
        console.log('deposit - GasUsed', receipt.gasUsed.toString())

        console.log("Value In Pool: ", (await moneyPrinterVault.getValueInPool()).toString())

        let sharesAfter = await moneyPrinterVault.balanceOf(unlockedUser.address)
        expect(sharesBefore.lt(sharesAfter))

        console.log('shares', sharesAfter.toString())

        // await moneyPrinterVault.connect(unlockedUser2).deposit(ethers.utils.parseUnits("50", 6), USDC.address)
        // console.log("Value In Pool: ", (await moneyPrinterVault.getValueInPool()).toString())
        // tx = await moneyPrinterVault.connect(unlockedUser).withdraw(sharesAfter, USDC.address)
        tx = await moneyPrinterVault.connect(admin).harvest()
        receipt = await tx.wait()
        console.log('Invest - GasUsed', receipt.gasUsed.toString())
        console.log("Value In Pool: ", (await moneyPrinterVault.getValueInPool()).toString())
        
        tx = await moneyPrinterVault.connect(unlockedUser).withdraw(sharesAfter, USDC.address);
        receipt = await tx.wait()
        console.log('Withdraw - GasUsed', receipt.gasUsed.toString())

    })
})