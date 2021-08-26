interface IMasterChef {
    function deposit(uint256 _pid, uint256 _amount) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
    function userInfo(uint _pid, address _user) external view returns(uint amount, uint rewardDebt);

    //masterChed v2 
    function harvest(uint256 pid, address to) external;
    function deposit(uint256 pid, uint256 amount, address to) external;
    function withdraw(uint256 pid, uint256 amount, address to) external;
}