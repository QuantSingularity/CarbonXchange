// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IAdvancedCarbonCreditToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function getVintageBalance(
        address user,
        uint256 vintageYear
    ) external view returns (uint256);
    function needsComplianceCheck(address user) external view returns (bool);
    function blacklisted(address user) external view returns (bool);
}

/**
 * @title AdvancedMarketplace
 * @dev Sophisticated marketplace for carbon credit trading with advanced financial features
 * Features:
 * - Multiple order types (Market, Limit, Stop, Stop-Limit)
 * - Automated market making
 * - Price discovery mechanisms
 * - Settlement and clearing
 * - Risk management
 * - Compliance integration
 * - Fee management
 * - Auction mechanisms
 */
contract AdvancedMarketplace is ReentrancyGuard, AccessControl, Pausable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MARKET_MAKER_ROLE = keccak256("MARKET_MAKER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");

    // Counters
    Counters.Counter private _orderIdCounter;
    Counters.Counter private _tradeIdCounter;
    Counters.Counter private _auctionIdCounter;

    // Contracts
    IAdvancedCarbonCreditToken public carbonToken;
    IERC20 public paymentToken; // USDC or similar stablecoin

    // Structs
    struct Order {
        uint256 orderId;
        address trader;
        OrderType orderType;
        OrderSide side;
        uint256 amount;
        uint256 price; // Price per token in payment token units
        uint256 filledAmount;
        uint256 stopPrice; // For stop orders
        uint256 createdAt;
        uint256 expiresAt;
        OrderStatus status;
        uint256 vintageYear;
        bytes32 clientOrderId;
        uint256 minFillAmount; // Minimum fill amount
        bool isIcebergOrder;
        uint256 visibleAmount; // For iceberg orders
    }

    struct Trade {
        uint256 tradeId;
        uint256 buyOrderId;
        uint256 sellOrderId;
        address buyer;
        address seller;
        uint256 amount;
        uint256 price;
        uint256 timestamp;
        uint256 buyerFee;
        uint256 sellerFee;
        TradeStatus status;
        uint256 settlementDate;
    }

    struct MarketData {
        uint256 lastPrice;
        uint256 volume24h;
        uint256 high24h;
        uint256 low24h;
        uint256 openPrice;
        uint256 bidPrice;
        uint256 askPrice;
        uint256 bidSize;
        uint256 askSize;
        uint256 lastUpdate;
    }

    struct Auction {
        uint256 auctionId;
        address seller;
        uint256 amount;
        uint256 reservePrice;
        uint256 startTime;
        uint256 endTime;
        uint256 highestBid;
        address highestBidder;
        AuctionStatus status;
        uint256 vintageYear;
        string description;
    }

    struct LiquidityPool {
        uint256 carbonReserve;
        uint256 paymentReserve;
        uint256 totalShares;
        mapping(address => uint256) shares;
        uint256 feeRate; // Fee rate for AMM trades
    }

    // Enums
    enum OrderType {
        Market,
        Limit,
        Stop,
        StopLimit,
        IcebergLimit
    }
    enum OrderSide {
        Buy,
        Sell
    }
    enum OrderStatus {
        Active,
        PartiallyFilled,
        Filled,
        Cancelled,
        Expired,
        Rejected
    }
    enum TradeStatus {
        Pending,
        Settled,
        Failed,
        Cancelled
    }
    enum AuctionStatus {
        Active,
        Ended,
        Cancelled
    }

    // State variables
    mapping(uint256 => Order) public orders;
    mapping(uint256 => Trade) public trades;
    mapping(uint256 => Auction) public auctions;
    mapping(address => uint256[]) public userOrders;
    mapping(address => uint256[]) public userTrades;

    // Order books (simplified - would use more efficient data structures in production)
    uint256[] public buyOrders; // Sorted by price descending
    uint256[] public sellOrders; // Sorted by price ascending

    // Market data
    MarketData public marketData;
    mapping(uint256 => uint256) public dailyVolume; // timestamp => volume
    mapping(uint256 => uint256) public priceHistory; // timestamp => price

    // Liquidity pool
    LiquidityPool public liquidityPool;

    // Fee structure
    uint256 public makerFeeRate = 10; // 0.1% (10/10000)
    uint256 public takerFeeRate = 20; // 0.2% (20/10000)
    uint256 public auctionFeeRate = 50; // 0.5% (50/10000)
    address public feeRecipient;

    // Trading parameters
    uint256 public minOrderSize = 1 * 10 ** 18; // 1 token minimum
    uint256 public maxOrderSize = 1000000 * 10 ** 18; // 1M tokens maximum
    uint256 public maxOrderDuration = 30 days;
    uint256 public priceTickSize = 1000; // Minimum price increment (0.001 payment tokens)

    // Risk management
    mapping(address => uint256) public userDailyVolume;
    mapping(address => uint256) public userLastTradeDay;
    uint256 public maxDailyVolumePerUser = 100000 * 10 ** 18; // 100k tokens

    // Circuit breakers
    uint256 public maxPriceDeviation = 1000; // 10% (1000/10000)
    bool public circuitBreakerTriggered = false;
    uint256 public circuitBreakerCooldown = 1 hours;
    uint256 public lastCircuitBreakerTime;

    // Events
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed trader,
        OrderType orderType,
        OrderSide side,
        uint256 amount,
        uint256 price
    );
    event OrderCancelled(uint256 indexed orderId, address indexed trader);
    event OrderFilled(
        uint256 indexed orderId,
        uint256 filledAmount,
        uint256 remainingAmount
    );
    event TradeExecuted(
        uint256 indexed tradeId,
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId,
        address buyer,
        address seller,
        uint256 amount,
        uint256 price
    );
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        uint256 amount,
        uint256 reservePrice
    );
    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount
    );
    event AuctionEnded(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 winningBid
    );
    event LiquidityAdded(
        address indexed provider,
        uint256 carbonAmount,
        uint256 paymentAmount,
        uint256 shares
    );
    event LiquidityRemoved(
        address indexed provider,
        uint256 shares,
        uint256 carbonAmount,
        uint256 paymentAmount
    );
    event CircuitBreakerTriggered(uint256 price, uint256 deviation);
    event MarketDataUpdated(uint256 price, uint256 volume);

    // Modifiers
    modifier onlyCompliantUser(address user) {
        require(!carbonToken.blacklisted(user), "User is blacklisted");
        require(
            !carbonToken.needsComplianceCheck(user),
            "User needs compliance check"
        );
        _;
    }

    modifier withinDailyLimit(address user, uint256 amount) {
        uint256 today = block.timestamp / 1 days;
        if (userLastTradeDay[user] != today) {
            userDailyVolume[user] = 0;
            userLastTradeDay[user] = today;
        }

        require(
            userDailyVolume[user].add(amount) <= maxDailyVolumePerUser,
            "Daily volume limit exceeded"
        );
        _;
    }

    modifier circuitBreakerCheck(uint256 price) {
        if (!circuitBreakerTriggered && marketData.lastPrice > 0) {
            uint256 deviation =
                price > marketData.lastPrice
                    ? price.sub(marketData.lastPrice).mul(10000).div(
                        marketData.lastPrice
                    )
                    : marketData.lastPrice.sub(price).mul(10000).div(
                        marketData.lastPrice
                    );

            if (deviation > maxPriceDeviation) {
                circuitBreakerTriggered = true;
                lastCircuitBreakerTime = block.timestamp;
                emit CircuitBreakerTriggered(price, deviation);
                revert("Circuit breaker triggered");
            }
        }

        if (circuitBreakerTriggered) {
            require(
                block.timestamp >=
                    lastCircuitBreakerTime.add(circuitBreakerCooldown),
                "Circuit breaker active"
            );
            circuitBreakerTriggered = false;
        }
        _;
    }

    constructor(
        address carbonToken_,
        address paymentToken_,
        address admin,
        address feeRecipient_
    ) {
        carbonToken = IAdvancedCarbonCreditToken(carbonToken_);
        paymentToken = IERC20(paymentToken_);
        feeRecipient = feeRecipient_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(MARKET_MAKER_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
        _grantRole(SETTLEMENT_ROLE, admin);

        // Initialize counters
        _orderIdCounter.increment();
        _tradeIdCounter.increment();
        _auctionIdCounter.increment();

        // Initialize market data
        marketData.lastUpdate = block.timestamp;
    }

    /**
     * @dev Place a new order
     */
    function placeOrder(
        OrderType orderType,
        OrderSide side,
        uint256 amount,
        uint256 price,
        uint256 stopPrice,
        uint256 expiresAt,
        uint256 vintageYear,
        bytes32 clientOrderId,
        uint256 minFillAmount,
        bool isIcebergOrder,
        uint256 visibleAmount
    )
        external
        nonReentrant
        whenNotPaused
        onlyCompliantUser(msg.sender)
        withinDailyLimit(msg.sender, amount)
        returns (uint256)
    {
        require(
            amount >= minOrderSize && amount <= maxOrderSize,
            "Invalid order size"
        );
        require(price > 0 || orderType == OrderType.Market, "Invalid price");
        require(
            expiresAt == 0 ||
                expiresAt <= block.timestamp.add(maxOrderDuration),
            "Invalid expiration"
        );

        if (isIcebergOrder) {
            require(
                visibleAmount > 0 && visibleAmount < amount,
                "Invalid iceberg parameters"
            );
        }

        // Check user has sufficient balance/allowance
        if (side == OrderSide.Sell) {
            require(
                carbonToken.balanceOf(msg.sender) >= amount,
                "Insufficient carbon token balance"
            );
        } else {
            uint256 requiredPayment =
                orderType == OrderType.Market
                    ? amount.mul(marketData.askPrice).div(10 ** 18)
                    : amount.mul(price).div(10 ** 18);
            require(
                paymentToken.balanceOf(msg.sender) >= requiredPayment,
                "Insufficient payment token balance"
            );
        }

        uint256 orderId = _orderIdCounter.current();
        _orderIdCounter.increment();

        orders[orderId] = Order({
            orderId: orderId,
            trader: msg.sender,
            orderType: orderType,
            side: side,
            amount: amount,
            price: price,
            filledAmount: 0,
            stopPrice: stopPrice,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            status: OrderStatus.Active,
            vintageYear: vintageYear,
            clientOrderId: clientOrderId,
            minFillAmount: minFillAmount,
            isIcebergOrder: isIcebergOrder,
            visibleAmount: isIcebergOrder ? visibleAmount : amount
        });

        userOrders[msg.sender].push(orderId);

        // Add to order book
        if (side == OrderSide.Buy) {
            _insertBuyOrder(orderId);
        } else {
            _insertSellOrder(orderId);
        }

        emit OrderPlaced(orderId, msg.sender, orderType, side, amount, price);

        // Try to match immediately for market orders or if crossing spread
        if (orderType == OrderType.Market || _canExecuteImmediately(orderId)) {
            _matchOrders(orderId);
        }

        return orderId;
    }

    /**
     * @dev Cancel an existing order
     */
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(
            order.trader == msg.sender || hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        require(
            order.status == OrderStatus.Active ||
                order.status == OrderStatus.PartiallyFilled,
            "Cannot cancel order"
        );

        order.status = OrderStatus.Cancelled;
        _removeFromOrderBook(orderId);

        emit OrderCancelled(orderId, order.trader);
    }

    /**
     * @dev Execute trades between matching orders
     */
    function _matchOrders(uint256 newOrderId) internal {
        Order storage newOrder = orders[newOrderId];

        if (newOrder.side == OrderSide.Buy) {
            _matchBuyOrder(newOrderId);
        } else {
            _matchSellOrder(newOrderId);
        }
    }

    /**
     * @dev Match a buy order against sell orders
     */
    function _matchBuyOrder(uint256 buyOrderId) internal {
        Order storage buyOrder = orders[buyOrderId];

        for (
            uint256 i = 0;
            i < sellOrders.length && buyOrder.status == OrderStatus.Active;
            i++
        ) {
            uint256 sellOrderId = sellOrders[i];
            Order storage sellOrder = orders[sellOrderId];

            if (
                sellOrder.status != OrderStatus.Active &&
                sellOrder.status != OrderStatus.PartiallyFilled
            ) {
                continue;
            }

            // Check if orders can match
            bool canMatch = false;
            uint256 executionPrice = sellOrder.price;

            if (buyOrder.orderType == OrderType.Market) {
                canMatch = true;
            } else if (buyOrder.price >= sellOrder.price) {
                canMatch = true;
                executionPrice = sellOrder.price; // Price improvement for buyer
            }

            if (canMatch && buyOrder.vintageYear == sellOrder.vintageYear) {
                uint256 tradeAmount = _min(
                    buyOrder.amount.sub(buyOrder.filledAmount),
                    sellOrder.amount.sub(sellOrder.filledAmount)
                );

                if (buyOrder.isIcebergOrder) {
                    tradeAmount = _min(tradeAmount, buyOrder.visibleAmount);
                }
                if (sellOrder.isIcebergOrder) {
                    tradeAmount = _min(tradeAmount, sellOrder.visibleAmount);
                }

                if (
                    tradeAmount >= buyOrder.minFillAmount &&
                    tradeAmount >= sellOrder.minFillAmount
                ) {
                    _executeTrade(
                        buyOrderId,
                        sellOrderId,
                        tradeAmount,
                        executionPrice
                    );
                }
            }
        }
    }

    /**
     * @dev Match a sell order against buy orders
     */
    function _matchSellOrder(uint256 sellOrderId) internal {
        Order storage sellOrder = orders[sellOrderId];

        for (
            uint256 i = 0;
            i < buyOrders.length && sellOrder.status == OrderStatus.Active;
            i++
        ) {
            uint256 buyOrderId = buyOrders[i];
            Order storage buyOrder = orders[buyOrderId];

            if (
                buyOrder.status != OrderStatus.Active &&
                buyOrder.status != OrderStatus.PartiallyFilled
            ) {
                continue;
            }

            // Check if orders can match
            bool canMatch = false;
            uint256 executionPrice = buyOrder.price;

            if (sellOrder.orderType == OrderType.Market) {
                canMatch = true;
            } else if (sellOrder.price <= buyOrder.price) {
                canMatch = true;
                executionPrice = buyOrder.price; // Price improvement for seller
            }

            if (canMatch && buyOrder.vintageYear == sellOrder.vintageYear) {
                uint256 tradeAmount = _min(
                    buyOrder.amount.sub(buyOrder.filledAmount),
                    sellOrder.amount.sub(sellOrder.filledAmount)
                );

                if (buyOrder.isIcebergOrder) {
                    tradeAmount = _min(tradeAmount, buyOrder.visibleAmount);
                }
                if (sellOrder.isIcebergOrder) {
                    tradeAmount = _min(tradeAmount, sellOrder.visibleAmount);
                }

                if (
                    tradeAmount >= buyOrder.minFillAmount &&
                    tradeAmount >= sellOrder.minFillAmount
                ) {
                    _executeTrade(
                        buyOrderId,
                        sellOrderId,
                        tradeAmount,
                        executionPrice
                    );
                }
            }
        }
    }

    /**
     * @dev Execute a trade between two orders
     */
    function _executeTrade(
        uint256 buyOrderId,
        uint256 sellOrderId,
        uint256 amount,
        uint256 price
    ) internal circuitBreakerCheck(price) {
        Order storage buyOrder = orders[buyOrderId];
        Order storage sellOrder = orders[sellOrderId];

        uint256 tradeId = _tradeIdCounter.current();
        _tradeIdCounter.increment();

        // Calculate fees
        uint256 totalValue = amount.mul(price).div(10 ** 18);
        uint256 buyerFee = totalValue.mul(takerFeeRate).div(10000);
        uint256 sellerFee = totalValue.mul(makerFeeRate).div(10000);

        // Update order fill amounts
        buyOrder.filledAmount = buyOrder.filledAmount.add(amount);
        sellOrder.filledAmount = sellOrder.filledAmount.add(amount);

        // Update order statuses
        if (buyOrder.filledAmount == buyOrder.amount) {
            buyOrder.status = OrderStatus.Filled;
            _removeFromOrderBook(buyOrderId);
        } else {
            buyOrder.status = OrderStatus.PartiallyFilled;
        }

        if (sellOrder.filledAmount == sellOrder.amount) {
            sellOrder.status = OrderStatus.Filled;
            _removeFromOrderBook(sellOrderId);
        } else {
            sellOrder.status = OrderStatus.PartiallyFilled;
        }

        // Create trade record
        trades[tradeId] = Trade({
            tradeId: tradeId,
            buyOrderId: buyOrderId,
            sellOrderId: sellOrderId,
            buyer: buyOrder.trader,
            seller: sellOrder.trader,
            amount: amount,
            price: price,
            timestamp: block.timestamp,
            buyerFee: buyerFee,
            sellerFee: sellerFee,
            status: TradeStatus.Pending,
            settlementDate: block.timestamp.add(2 days) // T+2 settlement
        });

        userTrades[buyOrder.trader].push(tradeId);
        userTrades[sellOrder.trader].push(tradeId);

        // Update daily volume tracking
        uint256 today = block.timestamp / 1 days;
        userDailyVolume[buyOrder.trader] = userDailyVolume[buyOrder.trader].add(
            amount
        );
        userDailyVolume[sellOrder.trader] = userDailyVolume[sellOrder.trader]
            .add(amount);

        // Update market data
        _updateMarketData(price, amount);

        emit TradeExecuted(
            tradeId,
            buyOrderId,
            sellOrderId,
            buyOrder.trader,
            sellOrder.trader,
            amount,
            price
        );
        emit OrderFilled(
            buyOrderId,
            amount,
            buyOrder.amount.sub(buyOrder.filledAmount)
        );
        emit OrderFilled(
            sellOrderId,
            amount,
            sellOrder.amount.sub(sellOrder.filledAmount)
        );

        // Settle trade immediately for now (in production, would be done by settlement service)
        _settleTrade(tradeId);
    }

    /**
     * @dev Settle a trade
     */
    function _settleTrade(uint256 tradeId) internal {
        Trade storage trade = trades[tradeId];
        require(trade.status == TradeStatus.Pending, "Trade not pending");

        uint256 totalValue = trade.amount.mul(trade.price).div(10 ** 18);
        uint256 buyerTotal = totalValue.add(trade.buyerFee);
        uint256 sellerNet = totalValue.sub(trade.sellerFee);

        // Transfer carbon tokens from seller to buyer
        require(
            carbonToken.transferFrom(trade.seller, trade.buyer, trade.amount),
            "Carbon token transfer failed"
        );

        // Transfer payment tokens from buyer to seller
        require(
            paymentToken.transferFrom(trade.buyer, trade.seller, sellerNet),
            "Payment transfer to seller failed"
        );

        // Transfer fees to fee recipient
        if (trade.buyerFee > 0) {
            require(
                paymentToken.transferFrom(
                    trade.buyer,
                    feeRecipient,
                    trade.buyerFee
                ),
                "Buyer fee transfer failed"
            );
        }

        if (trade.sellerFee > 0) {
            require(
                paymentToken.transferFrom(
                    trade.seller,
                    feeRecipient,
                    trade.sellerFee
                ),
                "Seller fee transfer failed"
            );
        }

        trade.status = TradeStatus.Settled;
        trade.settlementDate = block.timestamp;
    }

    /**
     * @dev Create an auction
     */
    function createAuction(
        uint256 amount,
        uint256 reservePrice,
        uint256 duration,
        uint256 vintageYear,
        string memory description
    )
        external
        nonReentrant
        whenNotPaused
        onlyCompliantUser(msg.sender)
        returns (uint256)
    {
        require(amount > 0, "Invalid amount");
        require(duration > 0 && duration <= 7 days, "Invalid duration");
        require(
            carbonToken.balanceOf(msg.sender) >= amount,
            "Insufficient balance"
        );

        uint256 auctionId = _auctionIdCounter.current();
        _auctionIdCounter.increment();

        auctions[auctionId] = Auction({
            auctionId: auctionId,
            seller: msg.sender,
            amount: amount,
            reservePrice: reservePrice,
            startTime: block.timestamp,
            endTime: block.timestamp.add(duration),
            highestBid: 0,
            highestBidder: address(0),
            status: AuctionStatus.Active,
            vintageYear: vintageYear,
            description: description
        });

        // Lock the carbon tokens
        require(
            carbonToken.transferFrom(msg.sender, address(this), amount),
            "Token lock failed"
        );

        emit AuctionCreated(auctionId, msg.sender, amount, reservePrice);
        return auctionId;
    }

    /**
     * @dev Place a bid on an auction
     */
    function placeBid(
        uint256 auctionId,
        uint256 bidAmount
    ) external nonReentrant whenNotPaused onlyCompliantUser(msg.sender) {
        Auction storage auction = auctions[auctionId];
        require(auction.status == AuctionStatus.Active, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(bidAmount > auction.highestBid, "Bid too low");
        require(bidAmount >= auction.reservePrice, "Below reserve price");
        require(
            paymentToken.balanceOf(msg.sender) >= bidAmount,
            "Insufficient balance"
        );

        // Refund previous highest bidder
        if (auction.highestBidder != address(0)) {
            require(
                paymentToken.transfer(
                    auction.highestBidder,
                    auction.highestBid
                ),
                "Refund failed"
            );
        }

        // Lock new bid amount
        require(
            paymentToken.transferFrom(msg.sender, address(this), bidAmount),
            "Bid lock failed"
        );

        auction.highestBid = bidAmount;
        auction.highestBidder = msg.sender;

        emit BidPlaced(auctionId, msg.sender, bidAmount);
    }

    /**
     * @dev End an auction
     */
    function endAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.status == AuctionStatus.Active, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction still active");

        auction.status = AuctionStatus.Ended;

        if (auction.highestBidder != address(0)) {
            // Calculate fee
            uint256 fee = auction.highestBid.mul(auctionFeeRate).div(10000);
            uint256 sellerAmount = auction.highestBid.sub(fee);

            // Transfer carbon tokens to winner
            require(
                carbonToken.transfer(auction.highestBidder, auction.amount),
                "Token transfer failed"
            );

            // Transfer payment to seller
            require(
                paymentToken.transfer(auction.seller, sellerAmount),
                "Payment transfer failed"
            );

            // Transfer fee
            if (fee > 0) {
                require(
                    paymentToken.transfer(feeRecipient, fee),
                    "Fee transfer failed"
                );
            }

            emit AuctionEnded(
                auctionId,
                auction.highestBidder,
                auction.highestBid
            );
        } else {
            // No bids, return tokens to seller
            require(
                carbonToken.transfer(auction.seller, auction.amount),
                "Token return failed"
            );
        }
    }

    /**
     * @dev Add liquidity to AMM pool
     */
    function addLiquidity(
        uint256 carbonAmount,
        uint256 paymentAmount
    )
        external
        nonReentrant
        whenNotPaused
        onlyCompliantUser(msg.sender)
        returns (uint256 shares)
    {
        require(carbonAmount > 0 && paymentAmount > 0, "Invalid amounts");

        if (liquidityPool.totalShares == 0) {
            // First liquidity provider
            shares = _sqrt(carbonAmount.mul(paymentAmount));
        } else {
            // Calculate shares based on existing ratio
            uint256 carbonShares = carbonAmount
                .mul(liquidityPool.totalShares)
                .div(liquidityPool.carbonReserve);
            uint256 paymentShares = paymentAmount
                .mul(liquidityPool.totalShares)
                .div(liquidityPool.paymentReserve);
            shares = _min(carbonShares, paymentShares);
        }

        require(shares > 0, "Insufficient liquidity");

        // Transfer tokens to pool
        require(
            carbonToken.transferFrom(msg.sender, address(this), carbonAmount),
            "Carbon transfer failed"
        );
        require(
            paymentToken.transferFrom(msg.sender, address(this), paymentAmount),
            "Payment transfer failed"
        );

        // Update pool state
        liquidityPool.carbonReserve = liquidityPool.carbonReserve.add(
            carbonAmount
        );
        liquidityPool.paymentReserve = liquidityPool.paymentReserve.add(
            paymentAmount
        );
        liquidityPool.totalShares = liquidityPool.totalShares.add(shares);
        liquidityPool.shares[msg.sender] = liquidityPool.shares[msg.sender].add(
            shares
        );

        emit LiquidityAdded(msg.sender, carbonAmount, paymentAmount, shares);
    }

    /**
     * @dev Remove liquidity from AMM pool
     */
    function removeLiquidity(
        uint256 shares
    )
        external
        nonReentrant
        returns (uint256 carbonAmount, uint256 paymentAmount)
    {
        require(shares > 0, "Invalid shares");
        require(
            liquidityPool.shares[msg.sender] >= shares,
            "Insufficient shares"
        );

        // Calculate amounts to return
        carbonAmount = shares.mul(liquidityPool.carbonReserve).div(
            liquidityPool.totalShares
        );
        paymentAmount = shares.mul(liquidityPool.paymentReserve).div(
            liquidityPool.totalShares
        );

        // Update pool state
        liquidityPool.carbonReserve = liquidityPool.carbonReserve.sub(
            carbonAmount
        );
        liquidityPool.paymentReserve = liquidityPool.paymentReserve.sub(
            paymentAmount
        );
        liquidityPool.totalShares = liquidityPool.totalShares.sub(shares);
        liquidityPool.shares[msg.sender] = liquidityPool.shares[msg.sender].sub(
            shares
        );

        // Transfer tokens back
        require(
            carbonToken.transfer(msg.sender, carbonAmount),
            "Carbon transfer failed"
        );
        require(
            paymentToken.transfer(msg.sender, paymentAmount),
            "Payment transfer failed"
        );

        emit LiquidityRemoved(msg.sender, shares, carbonAmount, paymentAmount);
    }

    /**
     * @dev Update market data
     */
    function _updateMarketData(uint256 price, uint256 volume) internal {
        uint256 today = block.timestamp / 1 days;

        // Update daily volume
        dailyVolume[today] = dailyVolume[today].add(volume);

        // Update price history
        priceHistory[block.timestamp] = price;

        // Update market data
        if (marketData.lastUpdate / 1 days != today) {
            // New day - reset daily stats
            marketData.openPrice = price;
            marketData.high24h = price;
            marketData.low24h = price;
            marketData.volume24h = volume;
        } else {
            // Same day - update stats
            if (price > marketData.high24h) marketData.high24h = price;
            if (price < marketData.low24h) marketData.low24h = price;
            marketData.volume24h = marketData.volume24h.add(volume);
        }

        marketData.lastPrice = price;
        marketData.lastUpdate = block.timestamp;

        // Update bid/ask from order book
        _updateBidAsk();

        emit MarketDataUpdated(price, volume);
    }

    /**
     * @dev Update bid/ask prices from order book
     */
    function _updateBidAsk() internal {
        // Get best bid (highest buy order)
        if (buyOrders.length > 0) {
            Order storage bestBid = orders[buyOrders[0]];
            if (
                bestBid.status == OrderStatus.Active ||
                bestBid.status == OrderStatus.PartiallyFilled
            ) {
                marketData.bidPrice = bestBid.price;
                marketData.bidSize = bestBid.amount.sub(bestBid.filledAmount);
            }
        }

        // Get best ask (lowest sell order)
        if (sellOrders.length > 0) {
            Order storage bestAsk = orders[sellOrders[0]];
            if (
                bestAsk.status == OrderStatus.Active ||
                bestAsk.status == OrderStatus.PartiallyFilled
            ) {
                marketData.askPrice = bestAsk.price;
                marketData.askSize = bestAsk.amount.sub(bestAsk.filledAmount);
            }
        }
    }

    // Helper functions
    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    function _canExecuteImmediately(
        uint256 orderId
    ) internal view returns (bool) {
        Order storage order = orders[orderId];

        if (order.side == OrderSide.Buy && sellOrders.length > 0) {
            Order storage bestAsk = orders[sellOrders[0]];
            return order.price >= bestAsk.price;
        } else if (order.side == OrderSide.Sell && buyOrders.length > 0) {
            Order storage bestBid = orders[buyOrders[0]];
            return order.price <= bestBid.price;
        }

        return false;
    }

    // Order book management (simplified - would use heap/tree structures in production)
    function _insertBuyOrder(uint256 orderId) internal {
        buyOrders.push(orderId);
        // Sort by price descending (simplified)
        // In production, would use more efficient data structure
    }

    function _insertSellOrder(uint256 orderId) internal {
        sellOrders.push(orderId);
        // Sort by price ascending (simplified)
        // In production, would use more efficient data structure
    }

    function _removeFromOrderBook(uint256 orderId) internal {
        // Remove from buy orders
        for (uint256 i = 0; i < buyOrders.length; i++) {
            if (buyOrders[i] == orderId) {
                buyOrders[i] = buyOrders[buyOrders.length - 1];
                buyOrders.pop();
                break;
            }
        }

        // Remove from sell orders
        for (uint256 i = 0; i < sellOrders.length; i++) {
            if (sellOrders[i] == orderId) {
                sellOrders[i] = sellOrders[sellOrders.length - 1];
                sellOrders.pop();
                break;
            }
        }
    }

    // Admin functions
    function setFeeRates(
        uint256 makerFee,
        uint256 takerFee,
        uint256 auctionFee
    ) external onlyRole(ADMIN_ROLE) {
        require(
            makerFee <= 100 && takerFee <= 100 && auctionFee <= 200,
            "Fee rates too high"
        );
        makerFeeRate = makerFee;
        takerFeeRate = takerFee;
        auctionFeeRate = auctionFee;
    }

    function setTradingParameters(
        uint256 minSize,
        uint256 maxSize,
        uint256 maxDuration,
        uint256 tickSize
    ) external onlyRole(ADMIN_ROLE) {
        minOrderSize = minSize;
        maxOrderSize = maxSize;
        maxOrderDuration = maxDuration;
        priceTickSize = tickSize;
    }

    function setRiskParameters(
        uint256 maxDailyVolume,
        uint256 maxDeviation,
        uint256 cooldown
    ) external onlyRole(ADMIN_ROLE) {
        maxDailyVolumePerUser = maxDailyVolume;
        maxPriceDeviation = maxDeviation;
        circuitBreakerCooldown = cooldown;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // View functions
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    function getTrade(uint256 tradeId) external view returns (Trade memory) {
        return trades[tradeId];
    }

    function getAuction(
        uint256 auctionId
    ) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    function getMarketData() external view returns (MarketData memory) {
        return marketData;
    }

    function getUserOrders(
        address user
    ) external view returns (uint256[] memory) {
        return userOrders[user];
    }

    function getUserTrades(
        address user
    ) external view returns (uint256[] memory) {
        return userTrades[user];
    }

    function getLiquidityShares(address user) external view returns (uint256) {
        return liquidityPool.shares[user];
    }

    function getOrderBookDepth()
        external
        view
        returns (uint256[] memory, uint256[] memory)
    {
        return (buyOrders, sellOrders);
    }
}
