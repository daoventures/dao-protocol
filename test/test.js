const { ethers, artifacts, network } = require("hardhat")
const IERC20_ABI = require("../abis/IERC20_ABI.json")

const USDTAddr = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const USDCAddr = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const DAIAddr = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const WETHAddr = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const ILVAddr = "0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E"

const AXSETHAddr = "0x0C365789DbBb94A29F8720dc465554c587e897dB"
const SLPETHAddr = "0x8597fa0773888107E2867D36dd87Fe5bAFeAb328"
const ILVETHAddr = "0x6a091a3406E0073C3CD6340122143009aDac0EDa"
const GHSTETHAddr = "0xaB659deE3030602c1aF8C29D146fAcD4aeD6EC85"
const REVVETHAddr = "0xc926990039045611eb1DE520C1E249Fd0d20a8eA"
const MVIAddr = "0x72e364F2ABdC788b7E918bc238B21f109Cd634D7"

const sushiFarmAddr = "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd"
const illuviumAddr = "0x8B4d8443a0229349A9892D4F7CbE89eF5f843F72"

const unlockedAccAddr = "0x28C6c06298d514Db089934071355E5743bf21d60"

describe("Metaverse-Farmer", () => {
    it("should work", async () => {
        const [deployer, client, treasury, community, strategist, biconomy, admin] = await ethers.getSigners()

        // Deploy AXS-ETH
        const SushiL1Vault = await ethers.getContractFactory("DAOVaultOptionA", deployer)
        const sushiL1Vault = await SushiL1Vault.deploy()
        const sushiL1VaultArtifact = await artifacts.readArtifact("DAOVaultOptionA")
        const sushiL1VaultInterface = new ethers.utils.Interface(sushiL1VaultArtifact.abi)

        const SushiL1Factory = await ethers.getContractFactory("SushiOptionAFactory", deployer)
        const sushiL1Factory = await SushiL1Factory.deploy(sushiL1Vault.address)
        
        const dataAXSETH = sushiL1VaultInterface.encodeFunctionData(
            "initialize",
            [
                "DAOVaultAXSETH", "daoAXSETH", 231,
                WETHAddr, USDCAddr, AXSETHAddr,
                community.address, treasury.address, strategist.address, admin.address,
                sushiFarmAddr, 1
            ]
        )
        await sushiL1Factory.createVault(dataAXSETH)
        const AXSETHVaultAddr = await sushiL1Factory.getVault(0)
        const AXSETHVault = await ethers.getContractAt("DAOVaultOptionA", AXSETHVaultAddr, deployer)
        
        // Deploy ILV-ETH
        const ILVETHVaultFac = await ethers.getContractFactory("ILVETHVault", deployer)
        const ILVETHVault = await ILVETHVaultFac.deploy()
        await ILVETHVault.initialize("DAO L1 Sushi ILV-ETH", "daoSushiILV")
        
        // Main contract
        const MVFFactory = await ethers.getContractFactory("MVFVault")
        const mvfVault = await MVFFactory.deploy()
        await mvfVault.initialize(
            AXSETHVaultAddr, deployer.address, ILVETHVault.address, deployer.address,
            treasury.address, community.address, admin.address, strategist.address, biconomy.address,
            0, 0
        )
        
        // Set whitelist
        await AXSETHVault.whitelistContract(mvfVault.address, true)
        await ILVETHVault.setWhitelistAddress(mvfVault.address, true)

        // Unlock & transfer Stablecoins to client
        network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedAccAddr]})
        const unlockedAcc = await ethers.getSigner(unlockedAccAddr)
        const USDTContract = new ethers.Contract(USDTAddr, IERC20_ABI, unlockedAcc)
        const USDCContract = new ethers.Contract(USDCAddr, IERC20_ABI, unlockedAcc)
        const DAIContract = new ethers.Contract(DAIAddr, IERC20_ABI, unlockedAcc)
        await USDTContract.transfer(client.address, ethers.utils.parseUnits("10000", 6))
        await USDCContract.transfer(client.address, ethers.utils.parseUnits("10000", 6))
        await DAIContract.transfer(client.address, ethers.utils.parseUnits("10000", 18))

        // Deposit
        await USDTContract.connect(client).approve(mvfVault.address, ethers.constants.MaxUint256)
        await USDCContract.connect(client).approve(mvfVault.address, ethers.constants.MaxUint256)
        await DAIContract.connect(client).approve(mvfVault.address, ethers.constants.MaxUint256)
        await mvfVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), USDTAddr)
        await mvfVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), USDCAddr)
        await mvfVault.connect(client).deposit(ethers.utils.parseUnits("10000", 18), DAIAddr)

        // Invest
        await mvfVault.invest()
        // console.log(ethers.utils.formatEther(await mvfVault.getAllPoolInUSD()))
        // console.log(ethers.utils.formatEther(
        //     (await mvfVault.balanceOf(client.address))
        //     .mul(await mvfVault.getPricePerFullShare())
        //     .div(ethers.utils.parseEther("1"))
        // )) // User share in USD
        // console.log(ethers.utils.formatEther(await mvfVault.getPricePerFullShare())) // LP token price

        // // Check percentage keep in vault
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(mvfVault.address), 6))
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(mvfVault.address), 6))
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(mvfVault.address), 18))

        // Withdraw
        const portionShare = (await mvfVault.balanceOf(client.address)).div("3")
        await mvfVault.connect(client).withdraw(portionShare, USDTAddr)
        await mvfVault.connect(client).withdraw(portionShare, USDCAddr)
        await mvfVault.connect(client).withdraw(portionShare, DAIAddr)

        // Check balance
        console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(client.address), 6))
        console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(client.address), 6))
        console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(client.address), 18))
    })



    // it("should work", async () => {
    //     let tx, receipt
    //     const [deployer, client1, client2, client3] = await ethers.getSigners()

    //     const unlockedAccAddr = "0xafda0872177cae4336a16597f5d2f65d254a74c2"
    //     await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedAccAddr]})
    //     const unlockedAcc = await ethers.getSigner(unlockedAccAddr)

    //     // await deployer.sendTransaction({to: unlockedAccAddr, value: ethers.utils.parseEther("1")})

    //     const ILVETHVaultFac = await ethers.getContractFactory("ILVETHVault", deployer)
    //     const ILVETHVault = await ILVETHVaultFac.deploy()
    //     await ILVETHVault.initialize("DAO L1 Sushi ILV-ETH", "daoSushiILV")
    //     await ILVETHVault.setWhitelistAddress(client1.address, true)
    //     await ILVETHVault.setWhitelistAddress(client2.address, true)

    //     const ILVETHContract = new ethers.Contract(ILVETHAddr, IERC20_ABI, unlockedAcc)
    //     await ILVETHContract.transfer(client1.address, ethers.utils.parseEther("1"))
    //     await ILVETHContract.transfer(client2.address, ethers.utils.parseEther("1"))
    //     // await ILVETHContract.transfer(client3.address, ethers.utils.parseEther("1"))

    //     await ILVETHContract.connect(client1).approve(ILVETHVault.address, ethers.constants.MaxUint256)
    //     await ILVETHVault.connect(client1).deposit(ethers.utils.parseEther("1"))
    //     await ILVETHVault.invest()
    //     await ILVETHVault.harvest()
    //     await network.provider.send("evm_increaseTime", [365*86400/2+1])

    //     await ILVETHContract.connect(client2).approve(ILVETHVault.address, ethers.constants.MaxUint256)
    //     await ILVETHVault.connect(client2).deposit(ethers.utils.parseEther("1"))
    //     await ILVETHVault.invest()

    //     // await ILVETHContract.connect(client3).approve(ILVETHVault.address, ethers.constants.MaxUint256)
    //     // await ILVETHVault.connect(client3).deposit(ethers.utils.parseEther("1"))
    //     // console.log(ethers.utils.formatEther(await ILVETHVault.fees()))

    //     // console.log(ethers.utils.formatEther(await ILVETHVault.getPricePerFullShare(true))) // 2427.546198215187271096
    //     // console.log(ethers.utils.formatEther(await ILVETHVault.getPricePerFullShare(false))) // 1.000114694897692193

    //     // for (let i=0; i<10000; i++) {
    //     //     await network.provider.send("evm_mine")
    //     // }
    //     await ILVETHVault.harvest()
    //     await network.provider.send("evm_increaseTime", [365*86400/2+1])
    //     await ILVETHVault.unlock(0)
    //     await ILVETHVault.compound()
    //     await ILVETHVault.connect(client1).withdraw(ILVETHVault.balanceOf(client1.address))
    //     console.log(ethers.utils.formatEther(await ILVETHContract.balanceOf(client1.address))); // 1.000022577181585061

    //     await network.provider.send("evm_increaseTime", [365*86400/2+1])
    //     await ILVETHVault.unlock(1)
    //     await ILVETHVault.compound()
    //     await ILVETHVault.connect(client2).withdraw(ILVETHVault.balanceOf(client2.address))
    //     console.log(ethers.utils.formatEther(await ILVETHContract.balanceOf(client2.address))); // 0.999983640986847989
    // })
})