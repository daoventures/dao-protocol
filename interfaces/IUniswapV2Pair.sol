pragma solidity 0.7.6;

interface IUniswapV2Pair {
    // event Approval(address indexed owner, address indexed spender, uint value);
    // event Transfer(address indexed from, address indexed to, uint value);

    // function name() external pure returns (string memory);
    // function symbol() external pure returns (string memory);
    // function decimals() external pure returns (uint8);
    function totalSupply() external view returns (uint);
   
}
