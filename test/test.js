const { ethers } = require("hardhat")
const { expect } = require("chai")
const IERC20_ABI = require("../abis/IERC20_ABI.json")

// const unlockedAddress = "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE"
const unlockedAddress = "0x28C6c06298d514Db089934071355E5743bf21d60"
const USDTAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const DAIAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const WETHAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const yveCRVAddress = "0xc5bDdf9843308380375a611c18B50Fb9341f502A"
const yvBOOSTAddress = "0x9d409a0A012CFbA9B15F6D4B36Ac57A46966Ab9a"
const sushiSwapRouterAddress = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
const SUSHIAddress = "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2"
const SLPAddress = "0x9461173740D27311b176476FA27e94C681b1Ea6b"

describe("Yearn Strategy", () => {
    // it("should work", async () => {
    //     const [deployer] = await ethers.getSigners()
    //     const YearnStrategy = await ethers.getContractFactory("YearnStrategy", deployer)
    //     const yearnStrategy = await YearnStrategy.deploy()
    //     await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
    //     const unlockedSigner = await ethers.getSigner(unlockedAddress);
    //     const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, deployer);
    //     // const WETH_ABI = [
    //     //     "function deposit() external payable",
    //     //     "function withdraw(uint) external",
    //     //     "function transfer(address, uint) external",
    //     //     "function balanceOf(address) external view returns (uint)"
    //     // ]
    //     // const WETHContract = new ethers.Contract(WETHAddress, WETH_ABI, deployer);
    //     await USDTContract.connect(unlockedSigner).transfer(yearnStrategy.address, ethers.utils.parseUnits("1000", 6))
    //     // await USDCContract.connect(unlockedSigner).transfer(deployer.address, ethers.utils.parseUnits("1000", 6))
    //     // await DAIContract.connect(unlockedSigner).transfer(deployer.address, ethers.utils.parseUnits("1000", 18))
    //     // await WETHContract.deposit({value: ethers.utils.parseEther("1")})
    //     // await WETHContract.transfer(yearnStrategy.address, ethers.utils.parseEther("1"))
    //     // await deployer.sendTransaction({to: yearnStrategy.address, value: ethers.utils.parseEther("1")})
    //     await yearnStrategy.invest()
    //     await yearnStrategy.yield()

    //     // await USDTContract.connect(unlockedSigner).transfer(yearnStrategy.address, ethers.utils.parseUnits("1000", 6))
    //     // await yearnStrategy.invest()
    //     // await yearnStrategy.yield()

    //     await yearnStrategy.withdraw()
    // })

    it("should work", async () => {
        const [deployer] = await ethers.getSigners()
        const unlockedAddress1 = "0xfd79248460974b26d6931a511688535d85046e4a"
        await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress1],});
        const unlockedSigner = await ethers.getSigner(unlockedAddress1);
        // const yvBOOSTContract = new ethers.Contract(yvBOOSTAddress,
        //     ["function withdraw(uint) external", "function pricePerShare() external view returns (uint)"], 
        //     deployer
        // )
        // const yvBOOSTContract = new ethers.Contract(yvBOOSTAddress, IERC20_ABI, unlockedSigner)
        // const yveCRVContract = new ethers.Contract(yveCRVAddress, IERC20_ABI, deployer)
        // const WETHContract = new ethers.Contract(WETHAddress, IERC20_ABI, deployer)
        // console.log((await yveCRVContract.balanceOf(unlockedAddress1)).toString())
        // await yvBOOSTContract.withdraw("559420480515219944112")
        // console.log((await yveCRVContract.balanceOf(unlockedAddress1)).toString())
        // 578296524370167744340
        // 578296524370167744340

        // const sRouter = new ethers.Contract(
        //     "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
        //     ["function removeLiquidity(address, address, uint, uint, uint, address, uint) external"],
        //     unlockedSigner
        // )
        // const SLPContract = new ethers.Contract(SLPAddress, IERC20_ABI, unlockedSigner)
        // await SLPContract.approve(sRouter.address, ethers.constants.MaxUint256)
        // await sRouter.removeLiquidity(yvBOOSTAddress, WETHAddress, SLPContract.balanceOf(unlockedSigner.address), 0, 0, deployer.address, Math.round(Date.now() / 1000))
        // console.log((await yvBOOSTContract.balanceOf(deployer.address)).toString()) // 1710
        // console.log((await WETHContract.balanceOf(deployer.address)).toString()) // 1.241

        // const pJarContract = new ethers.Contract(
        //     "0xCeD67a187b923F0E5ebcc77C7f2F7da20099e378",
        //     ["function withdraw(uint) external", "function balanceOf(address) external view returns (uint)"],
        //     unlockedSigner
        // )
        // console.log((await SLPContract.balanceOf(unlockedAddress1)).toString())
        // await pJarContract.withdraw(pJarContract.balanceOf(unlockedAddress1))
        // console.log((await SLPContract.balanceOf(unlockedAddress1)).toString()) // 891.347936954211840646

        // const sRouter = new ethers.Contract(
        //     "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
        //     ["function swapExactTokensForTokens(uint, uint, address[] calldata , address, uint) external returns (uint[] memory)"],
        //     unlockedSigner
        // )
        // await yvBOOSTContract.approve(sRouter.address, ethers.constants.MaxUint256)
        // await sRouter.swapExactTokensForTokens(
        //     ethers.utils.parseEther("1"),
        //     0,
        //     [yvBOOSTAddress, WETHAddress],
        //     deployer.address,
        //     Math.round(Date.now() / 1000)
        // )
        // console.log((await WETHContract.balanceOf(deployer.address)).toString()) // 742056065803149

        // Calculate APR of yvBOOST
        // const yvBOOSTContract = new ethers.Contract(yvBOOSTAddress,
        //     ["function withdraw(uint) external", "function pricePerShare() external view returns (uint)"], 
        //     deployer
        // )
        // console.log((await yvBOOSTContract.pricePerShare()).toString())
        // 1033742139432512690
        // 1039777733325722763
        // const diff = (new ethers.BigNumber.from("1039777733325722763")).sub("1033742139432512690")
        // console.log((diff.mul(ethers.utils.parseEther("1")).div("1033742139432512690")).toString())
        // 0.005838587461011696 * 52 * 100% = 30.31% APR = 15.15% (half yvBOOST only)

        // Calculate APR of yvBOOST/ETH pool
        // const slpContract = new ethers.Contract(
        //     "0x9461173740D27311b176476FA27e94C681b1Ea6b",
        //     [
        //         "function getReserves() external view returns (uint112, uint112, uint32)",
        //         "function totalSupply() external view returns (uint)",
        //         "function kLast() external view returns (uint)",
        //         "function balanceOf(address) external view returns (uint)"
        //     ],
        //     deployer
        // )
        // const [reserveA, reserveB, _] = await slpContract.getReserves()
        // const totalSupply = await slpContract.totalSupply()
        // const kLast = reserveA.add(reserveB)
        // console.log((kLast.div(totalSupply)).toString()) // 1 LP = 38 reserve
        // console.log((kLast.mul(ethers.utils.parseEther("1")).div(totalSupply)).toString())
        // 37.851475951558878853
        // 38.698603478823986812
        // const diff = (new ethers.BigNumber.from("38698603478823986812")).sub("37851475951558878853")
        // console.log((diff.mul(ethers.utils.parseEther("1")).div("37851475951558878853")).toString())
        // 0.022380303699365249

        // // Calculate APR of pJar
        // const pJarContract = new ethers.Contract(
        //     "0xCeD67a187b923F0E5ebcc77C7f2F7da20099e378",
        //     ["function getRatio() external view returns (uint)"],
        //     deployer
        // )
        // console.log((await pJarContract.getRatio()).toString())
        // 1050132497458886157
        // 1054447864001513195
        // const diff = (new ethers.BigNumber.from("1054447864001513195")).sub("1050132497458886157")
        // console.log((diff.mul(ethers.utils.parseEther("1")).div("1050132497458886157")).toString())
        // 0.004109354346303323 * 52 * 100% = 21.36% APR

        // Calculate APR of pFarm
        const pFarmContract = new ethers.Contract(
            "0xDA481b277dCe305B97F4091bD66595d57CF31634",
            [
                "function rewardRate() external view returns (uint)",
                "function derivedSupply() external view returns (uint)",
                "function getRewardForDuration() external view returns (uint)",
                "function rewardPerToken() external view returns (uint)",
                "function totalSupply() external view returns (uint)"
            ],
            deployer
        )
        console.log((await pFarmContract.getRewardForDuration()).toString())
        // 1870.956283517598009600
        // 108271.991099351963289685
    })
})

