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

describe("Metaverse-Farmer", () => {
    // it("should work", async () => {
    //     const [deployer, treasury, community, strategist, biconomy, admin] = await ethers.getSigners()

    //     const SushiL1Vault = await ethers.getContractFactory("DAOVaultOptionA", deployer)
    //     const sushiL1Vault = await SushiL1Vault.deploy()
    //     const sushiL1VaultArtifact = await artifacts.readArtifact("DAOVaultOptionA")
    //     const sushiL1VaultInterface = new ethers.utils.Interface(sushiL1VaultArtifact.abi)

    //     const SushiL1Factory = await ethers.getContractFactory("SushiOptionAFactory", deployer)
    //     const sushiL1Factory = await SushiL1Factory.deploy(sushiL1Vault.address)
        
    //     const dataAXSETH = sushiL1VaultInterface.encodeFunctionData(
    //         "initialize",
    //         [
    //             "DAOVaultAXSETH", "daoAXSETH", 231,
    //             WETHAddr, USDCAddr, AXSETHAddr,
    //             community.address, treasury.address, strategist.address, admin.address,
    //             sushiFarmAddr, 1
    //         ]
    //     )
    //     await sushiL1Factory.createVault(dataAXSETH)
    //     const AXSETHVaultAddr = await sushiL1Factory.getVault(0)

    //     const dataILVETH = sushiL1VaultInterface.encodeFunctionData(
    //         "initialize",
    //         [
    //             "DAOVaultILVETH", "daoILVETH", 231,
    //             WETHAddr, USDCAddr, ILVETHAddr,
    //             community.address, treasury.address, strategist.address, admin.address,
    //             sushiFarmAddr, 1
    //         ]
    //     )
    //     await sushiL1Factory.createVault(dataILVETH)
    //     const ILVETHVaultAddr = await sushiL1Factory.getVault(0)

    //     const MVFFactory = await ethers.getContractFactory("MVFVault")
    //     const mvfVault = await MVFFactory.deploy()

    //     const AXSETHVault = await ethers.getContractAt("DAOVaultOptionA", AXSETHVaultAddr, deployer)
    //     await AXSETHVault.whitelistContract(mvfVault.address, true)

    //     let WETHContract
    //     WETHContract = new ethers.Contract(WETHAddr, ["function deposit() external payable"], deployer)
    //     await WETHContract.deposit({value: ethers.utils.parseEther("5")})
    //     WETHContract = new ethers.Contract(WETHAddr, IERC20_ABI, deployer)
    //     await mvfVault.initialize(AXSETHVaultAddr, deployer.address, deployer.address, deployer.address)
    //     await WETHContract.approve(mvfVault.address, ethers.constants.MaxUint256)
    //     await mvfVault.invest(ethers.utils.parseEther("2"))

    //     // const abi = ["function balanceOf(address) external view returns (uint)", "function userInfo(uint, address) external view returns (uint)"]
    //     // const AXSETHContract = new ethers.Contract(AXSETHAddr, abi, deployer)
    //     // const sushiFarmContract = new ethers.Contract(sushiFarmAddr, abi, deployer)
    //     // const SLPETHContract = new ethers.Contract(SLPETHAddr, abi, deployer)
    //     // const ILVETHContract = new ethers.Contract(ILVETHAddr, abi, deployer)
    //     // const illuviumContract = new ethers.Contract(illuviumAddr, abi, deployer)
    //     // const GHSTETHContract = new ethers.Contract(GHSTETHAddr, abi, deployer)
    //     // const REVVETHContract = new ethers.Contract(REVVETHAddr, abi, deployer)
    //     // const MVIContract = new ethers.Contract(MVIAddr, abi, deployer)
    //     // console.log(ethers.utils.formatEther(await AXSETHContract.balanceOf(mvfVault.address)))
    //     // console.log(ethers.utils.formatEther(await sushiFarmContract.userInfo(231, mvfVault.address)))
    //     // console.log(ethers.utils.formatEther(await SLPETHContract.balanceOf(mvfVault.address)))
    //     // console.log(ethers.utils.formatEther(await ILVETHContract.balanceOf(mvfVault.address)))
    //     // console.log(ethers.utils.formatEther(await illuviumContract.balanceOf(mvfVault.address)))
    //     // console.log(ethers.utils.formatEther(await GHSTETHContract.balanceOf(mvfVault.address)))
    //     // console.log(ethers.utils.formatEther(await REVVETHContract.balanceOf(mvfVault.address)))
    //     // console.log(ethers.utils.formatEther(await MVIContract.balanceOf(mvfVault.address)))
    // })

    it("should work", async () => {
        let tx, receipt
        const [deployer, client1, client2, client3] = await ethers.getSigners()

        const unlockedAccAddr = "0xafda0872177cae4336a16597f5d2f65d254a74c2"
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedAccAddr]})
        const unlockedAcc = await ethers.getSigner(unlockedAccAddr)

        // await deployer.sendTransaction({to: unlockedAccAddr, value: ethers.utils.parseEther("1")})

        const ILVETHVaultFac = await ethers.getContractFactory("ILVETHVault", deployer)
        const ILVETHVault = await ILVETHVaultFac.deploy()
        await ILVETHVault.initialize("DAO L1 Sushi ILV-ETH", "daoSushiILV")
        await ILVETHVault.setWhitelistAddress(client1.address, true)
        await ILVETHVault.setWhitelistAddress(client2.address, true)

        const ILVETHContract = new ethers.Contract(ILVETHAddr, IERC20_ABI, unlockedAcc)
        await ILVETHContract.transfer(client1.address, ethers.utils.parseEther("1"))
        await ILVETHContract.transfer(client2.address, ethers.utils.parseEther("1"))
        // await ILVETHContract.transfer(client3.address, ethers.utils.parseEther("1"))

        await ILVETHContract.connect(client1).approve(ILVETHVault.address, ethers.constants.MaxUint256)
        await ILVETHVault.connect(client1).deposit(ethers.utils.parseEther("1"))
        await ILVETHVault.invest()
        await ILVETHVault.harvest()
        await network.provider.send("evm_increaseTime", [365*86400/2+1])

        await ILVETHContract.connect(client2).approve(ILVETHVault.address, ethers.constants.MaxUint256)
        await ILVETHVault.connect(client2).deposit(ethers.utils.parseEther("1"))
        await ILVETHVault.invest()

        // await ILVETHContract.connect(client3).approve(ILVETHVault.address, ethers.constants.MaxUint256)
        // await ILVETHVault.connect(client3).deposit(ethers.utils.parseEther("1"))
        // console.log(ethers.utils.formatEther(await ILVETHVault.fees()))

        // console.log(ethers.utils.formatEther(await ILVETHVault.getPricePerFullShare(true))) // 2427.546198215187271096
        // console.log(ethers.utils.formatEther(await ILVETHVault.getPricePerFullShare(false))) // 1.000114694897692193

        // for (let i=0; i<10000; i++) {
        //     await network.provider.send("evm_mine")
        // }
        await ILVETHVault.harvest()
        await network.provider.send("evm_increaseTime", [365*86400/2+1])
        await ILVETHVault.unlock(0)
        await ILVETHVault.compound()
        await ILVETHVault.connect(client1).withdraw(ILVETHVault.balanceOf(client1.address))
        console.log(ethers.utils.formatEther(await ILVETHContract.balanceOf(client1.address))); // 1.000022577181585061

        await network.provider.send("evm_increaseTime", [365*86400/2+1])
        await ILVETHVault.unlock(1)
        await ILVETHVault.compound()
        await ILVETHVault.connect(client2).withdraw(ILVETHVault.balanceOf(client2.address))
        console.log(ethers.utils.formatEther(await ILVETHContract.balanceOf(client2.address))); // 0.999983640986847989
    })
})