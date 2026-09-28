// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {NischitEscrow} from "../NischitEscrow.sol";

contract MockToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount && (msg.sender == from || allowance[from][msg.sender] >= amount), "transferFrom");
        if (msg.sender != from) allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "transfer");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract NischitEscrowTest {
    function testFundSettleSplit() external {
        MockToken token = new MockToken();
        NischitEscrow escrow = new NischitEscrow();
        address supplier = address(0xBEEF);
        token.mint(address(this), 100);
        token.approve(address(escrow), 100);
        escrow.fund(bytes32(uint256(1)), address(token), supplier, 100);
        escrow.settle(bytes32(uint256(1)), 95, 5);
        require(token.balanceOf(supplier) == 95, "supplier split");
        require(token.balanceOf(address(this)) == 5, "buyer credit");
    }

    function testRefundReturnsEscrowedAmount() external {
        MockToken token = new MockToken();
        NischitEscrow escrow = new NischitEscrow();
        token.mint(address(this), 100);
        token.approve(address(escrow), 100);
        escrow.fund(bytes32(uint256(2)), address(token), address(0xBEEF), 100);
        escrow.refund(bytes32(uint256(2)));
        require(token.balanceOf(address(this)) == 100, "refund");
    }
}
