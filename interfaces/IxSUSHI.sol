pragma solidity 0.7.6;
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IxSUSHI is IERC20Upgradeable{
    function enter(uint256 _amount) external;
    function leave(uint256 _share) external;
}