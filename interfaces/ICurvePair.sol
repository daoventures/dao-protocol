interface ICurvePair {
    function add_liquidity(uint[3] memory _amounts, uint _min_mint_amount, bool _use_underlying) external returns (uint);
    function remove_liquidity(uint _amount, uint[3] memory _min_amounts, bool _use_underlying) external returns (uint[3] memory);
}
// add_liquidity(_amounts: uint256[N_COINS], _min_mint_amount: uint256, _use_underlying: bool = False) -> uint256: