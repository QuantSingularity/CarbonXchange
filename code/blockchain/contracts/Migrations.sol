// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Migrations
/// @dev Standard Truffle bookkeeping contract that tracks which migration
/// scripts have already been run against a given network. This contract is
/// deployed first by migrations/1_initial_migration.js.
contract Migrations {
    address public owner;
    uint256 public lastCompletedMigration;

    modifier restricted() {
        require(
            msg.sender == owner,
            "Migrations: caller is not the contract owner"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setCompleted(uint256 completed) public restricted {
        lastCompletedMigration = completed;
    }
}
