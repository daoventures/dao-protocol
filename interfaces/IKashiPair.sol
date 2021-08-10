pragma solidity 0.7.6;
// import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IKashiPair {
    function addAsset(address to, bool skim, uint256 share) external returns (uint256 fraction);
    function removeAsset(address to, uint256 fraction) external returns  (uint256 share) ;
    function balanceOf(address) external view returns (uint);

    function bentoBox() external view returns (address);
    function masterContract() external view returns (address);
    function withdrawFees() external ;
    
}