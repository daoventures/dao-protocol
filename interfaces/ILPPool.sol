pragma solidity ^0.7.4;


interface ILPPool {
    //================== Callers ==================//
    //function mir() external view returns (IERC20);
    function balanceOf(address account) external view returns (uint256);

    function startTime() external view returns (uint256);

    function totalReward() external view returns (uint256);

    function earned(address account) external view returns (uint256);

    //================== Transactors ==================//

    function stake(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function exit() external;

    function getReward() external;
}