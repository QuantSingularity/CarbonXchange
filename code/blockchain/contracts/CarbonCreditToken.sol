// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title CarbonCreditToken
/// @dev Fungible ERC20 token representing tokenized carbon credits. Each
/// token represents one tonne of CO2-equivalent. This is the lightweight
/// version of the token used by the simple Marketplace contract; see
/// AdvancedCarbonCreditToken for the full-featured, compliance-aware token.
contract CarbonCreditToken is ERC20, ERC20Burnable, Ownable {
    /// @dev Emitted whenever new credits are minted into circulation.
    event CreditsMinted(address indexed to, uint256 amount);

    constructor(
        address initialOwner
    ) ERC20("CarbonCredit", "CCO2") Ownable(initialOwner) {
        _mint(initialOwner, 1_000_000 * 10 ** decimals());
    }

    /// @notice Mint new carbon credit tokens.
    /// @dev Restricted to the contract owner (e.g. the verified issuance
    /// authority). Reverts on a zero recipient or zero amount to avoid
    /// silently burning gas on a no-op mint.
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "CarbonCreditToken: mint to zero address");
        require(amount > 0, "CarbonCreditToken: amount must be positive");
        _mint(to, amount);
        emit CreditsMinted(to, amount);
    }
}
