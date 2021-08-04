const { ethers, upgrades } = require("hardhat")
const { expect } = require("chai")
const IERC20_ABI = require("../abis/IERC20_ABI.json")

const unlockedAddr = "0x28C6c06298d514Db089934071355E5743bf21d60"

const USDTAddr = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const USDCAddr = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const DAIAddr = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const WETHAddr = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"

const USDTVaultAddr = "0x4F0C1c9bA6B9CCd0BEd6166e86b672ac8EE621F7"
const USDCVaultAddr = "0x9f0230FbDC0379E5FefAcca89bE03A42Fec5fb6E"
const DAIVaultAddr = "0x2bFc2Da293C911e5FfeC4D2A2946A599Bc4Ae770"
const TUSDVaultAddr = "0x2C8de02aD4312069355B94Fb936EFE6CFE0C8FF6"

describe("Yearn Strategy", () => {
    it("should work", async () => {
        const [deployer, client, treasury, community, strategist, admin] = await ethers.getSigners()
        
        const YearnStrategy = await ethers.getContractFactory("YearnStrategy", deployer)
        const yearnStrategy = await upgrades.deployProxy(YearnStrategy, [
            treasury.address, community.address, strategist.address, admin.address
        ])
        await yearnStrategy.deployed()
    })
})

