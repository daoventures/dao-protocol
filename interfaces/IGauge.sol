interface IGauge {
    function balanceOf(address _address) external view returns (uint256);
    function deposit(uint256 _amount) external;
    function withdraw(uint256 _amount) external;
    function claim_reward() external;
}