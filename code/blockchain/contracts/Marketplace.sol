// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);
}

contract Marketplace {
    struct Listing {
        address seller;
        uint256 amount;
        uint256 pricePerToken;
    }

    IERC20 public token;
    Listing[] public listings;

    event NewListing(uint256 listingId, address seller, uint256 amount);
    event Purchase(address buyer, uint256 listingId, uint256 amount);

    constructor(address _tokenAddress) {
        token = IERC20(_tokenAddress);
    }

    function createListing(uint256 amount, uint256 price) external {
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        listings.push(Listing(msg.sender, amount, price));
        emit NewListing(listings.length - 1, msg.sender, amount);
    }

    function buyCredits(uint256 listingId, uint256 amount) external payable {
        Listing storage listing = listings[listingId];
        require(
            msg.value == amount * listing.pricePerToken,
            "Incorrect payment"
        );
        require(
            token.transferFrom(address(this), msg.sender, amount),
            "Transfer failed"
        );
        payable(listing.seller).transfer(msg.value);
        emit Purchase(msg.sender, listingId, amount);
    }
}
