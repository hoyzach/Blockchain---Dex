//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Link is ERC20{
    constructor() ERC20("Chainlink","LINK") {
        _mint(msg.sender,1000);
    }
}