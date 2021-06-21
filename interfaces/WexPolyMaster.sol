interface WexPolyMaster {
    function deposit(uint256 _pid, uint256 _amount, bool _withdrawRewards) external;
    function withdraw(uint256 _pid, uint256 _amount, bool _withdrawRewards) external;
    function claim(uint256 _pid) external;

    function pendingWex(uint _pid, address _user)external view returns (uint);
    function userInfo(uint pid, address userAddress)external view returns (uint amount, uint rewardDebt, uint pendingRewards);
}