// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Marketplace
/// @dev Simple escrow-based marketplace for buying and selling
/// CarbonCreditToken. Sellers list an amount of tokens at a fixed price per
/// token (in wei); buyers purchase all or part of a listing by sending the
/// exact ETH value required. Listed tokens are custodied by this contract
/// until purchased or the listing is cancelled.
contract Marketplace is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        uint256 amount; // remaining unsold amount (token base units, 18 decimals)
        uint256 pricePerToken; // price in wei per *whole* token (i.e. per 1e18 base units)
        bool active;
    }

    IERC20 public immutable token;
    Listing[] public listings;

    event NewListing(
        uint256 indexed listingId,
        address indexed seller,
        uint256 amount,
        uint256 pricePerToken
    );
    event Purchase(
        address indexed buyer,
        uint256 indexed listingId,
        uint256 amount,
        uint256 paid
    );
    event ListingCancelled(uint256 indexed listingId, address indexed seller);

    constructor(address tokenAddress) {
        require(tokenAddress != address(0), "Marketplace: invalid token");
        token = IERC20(tokenAddress);
    }

    modifier validListing(uint256 listingId) {
        require(listingId < listings.length, "Marketplace: invalid listing");
        _;
    }

    /// @notice List carbon credit tokens for sale. The seller must have
    /// approved this contract for at least `amount` beforehand.
    function createListing(
        uint256 amount,
        uint256 pricePerToken
    ) external nonReentrant returns (uint256 listingId) {
        require(amount > 0, "Marketplace: amount must be positive");
        require(pricePerToken > 0, "Marketplace: price must be positive");

        listingId = listings.length;
        listings.push(
            Listing({
                seller: msg.sender,
                amount: amount,
                pricePerToken: pricePerToken,
                active: true
            })
        );

        // Escrow the tokens in this contract.
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit NewListing(listingId, msg.sender, amount, pricePerToken);
    }

    /// @notice Purchase `amount` tokens from an active listing, paying the
    /// exact ETH amount required. Any ETH sent above the required amount is
    /// refunded to the buyer.
    function buyCredits(
        uint256 listingId,
        uint256 amount
    ) external payable nonReentrant validListing(listingId) {
        Listing storage listing = listings[listingId];
        require(listing.active, "Marketplace: listing not active");
        require(amount > 0, "Marketplace: amount must be positive");
        require(
            amount <= listing.amount,
            "Marketplace: amount exceeds listing"
        );

        uint256 cost = (amount * listing.pricePerToken) / 1e18;
        require(msg.value >= cost, "Marketplace: insufficient payment");

        // Effects before interactions.
        listing.amount -= amount;
        if (listing.amount == 0) {
            listing.active = false;
        }

        address seller = listing.seller;

        // Send the purchased tokens to the buyer out of escrow.
        token.safeTransfer(msg.sender, amount);

        // Forward payment to the seller.
        (bool sentToSeller, ) = payable(seller).call{value: cost}("");
        require(sentToSeller, "Marketplace: payment to seller failed");

        // Refund any overpayment to the buyer.
        uint256 refund = msg.value - cost;
        if (refund > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: refund}("");
            require(refunded, "Marketplace: refund failed");
        }

        emit Purchase(msg.sender, listingId, amount, cost);
    }

    /// @notice Cancel a listing and return any unsold escrowed tokens to
    /// the seller.
    function cancelListing(
        uint256 listingId
    ) external nonReentrant validListing(listingId) {
        Listing storage listing = listings[listingId];
        require(listing.active, "Marketplace: listing not active");
        require(listing.seller == msg.sender, "Marketplace: not the seller");

        uint256 remaining = listing.amount;
        listing.amount = 0;
        listing.active = false;

        if (remaining > 0) {
            token.safeTransfer(msg.sender, remaining);
        }

        emit ListingCancelled(listingId, msg.sender);
    }

    function totalListings() external view returns (uint256) {
        return listings.length;
    }
}
