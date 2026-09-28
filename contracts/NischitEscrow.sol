// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Like {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

/// @notice Minimal single-receipt escrow used by the Tempo testnet adapter.
/// @dev This contract is an example implementation. It is not audited or
/// approved for production deployment. Any deployment requires independent
/// review of authorization, custody, and recovery behavior. This contract is
/// not a substitute for an audited production custody or payment arrangement.
contract NischitEscrow {
    struct Order {
        address buyer;
        address token;
        address supplier;
        uint256 amount;
        bool funded;
        bool settled;
    }

    mapping(bytes32 => Order) public orders;

    event Funded(bytes32 indexed orderRef, address indexed buyer, address indexed supplier, address token, uint256 amount);
    event Settled(bytes32 indexed orderRef, uint256 supplierAmount, uint256 buyerCredit);
    event Refunded(bytes32 indexed orderRef, uint256 amount);

    function fund(bytes32 orderRef, address token, address supplier, uint256 amount) external {
        require(orderRef != bytes32(0), "order ref required");
        require(token != address(0) && supplier != address(0), "address required");
        require(amount > 0, "amount required");
        Order storage order = orders[orderRef];
        require(!order.funded, "already funded");
        require(IERC20Like(token).transferFrom(msg.sender, address(this), amount), "fund transfer failed");
        order.buyer = msg.sender;
        order.token = token;
        order.supplier = supplier;
        order.amount = amount;
        order.funded = true;
        emit Funded(orderRef, msg.sender, supplier, token, amount);
    }

    function settle(bytes32 orderRef, uint256 supplierAmount, uint256 buyerCredit) external {
        Order storage order = orders[orderRef];
        require(order.funded && !order.settled, "order unavailable");
        require(msg.sender == order.buyer, "buyer only");
        require(supplierAmount + buyerCredit == order.amount, "split mismatch");
        order.settled = true;
        if (supplierAmount > 0) require(IERC20Like(order.token).transfer(order.supplier, supplierAmount), "supplier transfer failed");
        if (buyerCredit > 0) require(IERC20Like(order.token).transfer(order.buyer, buyerCredit), "buyer credit failed");
        emit Settled(orderRef, supplierAmount, buyerCredit);
    }

    function refund(bytes32 orderRef) external {
        Order storage order = orders[orderRef];
        require(order.funded && !order.settled, "order unavailable");
        require(msg.sender == order.buyer, "buyer only");
        order.settled = true;
        require(IERC20Like(order.token).transfer(order.buyer, order.amount), "refund transfer failed");
        emit Refunded(orderRef, order.amount);
    }
}
