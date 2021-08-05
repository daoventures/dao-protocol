interface IMasterChef {
    function deposit(uint256 _pid, uint256 _amount) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
    function userInfo(uint _pid, address _user) external view returns(uint amount, uint rewardDebt);
}