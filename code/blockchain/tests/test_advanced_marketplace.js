const AdvancedCarbonCreditToken = artifacts.require(
  "AdvancedCarbonCreditToken",
);
const CarbonCreditToken = artifacts.require("CarbonCreditToken");
const AdvancedMarketplace = artifacts.require("AdvancedMarketplace");

const { expectRevert } = require("./helpers/expectRevert");

const OrderType = { Market: 0, Limit: 1, Stop: 2, StopLimit: 3 };
const OrderSide = { Buy: 0, Sell: 1 };
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000".slice(
    0,
    66,
  );

contract("AdvancedMarketplace", (accounts) => {
  const [admin, seller, buyer, feeRecipient, other] = accounts;

  const CURRENT_YEAR = new Date().getFullYear();
  const DOC_HASH = web3.utils.keccak256("ipfs://project-docs");

  let carbonToken;
  let paymentToken;
  let marketplace;

  beforeEach(async () => {
    carbonToken = await AdvancedCarbonCreditToken.new(
      "Advanced Carbon Credit",
      "ACCO2",
      admin,
      feeRecipient,
      { from: admin },
    );

    // A plain ERC20 stands in for the settlement / payment token (e.g. a
    // stablecoin) in tests.
    paymentToken = await CarbonCreditToken.new(admin, { from: admin });

    marketplace = await AdvancedMarketplace.new(
      carbonToken.address,
      paymentToken.address,
      admin,
      feeRecipient,
      { from: admin },
    );

    // Issue carbon credits to the seller via the project flow.
    const VERIFIER_ROLE = await carbonToken.VERIFIER_ROLE();
    await carbonToken.grantRole(VERIFIER_ROLE, admin, { from: admin });
    await carbonToken.registerProject(
      "Reforestation Project A",
      "VM0007",
      "Brazil",
      seller,
      CURRENT_YEAR,
      web3.utils.toWei("10000", "ether"),
      "Verra",
      DOC_HASH,
      { from: admin },
    );
    await carbonToken.verifyProject(1, { from: admin });
    await carbonToken.issueCarbonCredits(
      1,
      web3.utils.toWei("1000", "ether"),
      "SN-0001",
      DOC_HASH,
      { from: admin },
    );

    // Fund the buyer with payment tokens.
    await paymentToken.mint(buyer, web3.utils.toWei("100000", "ether"), {
      from: admin,
    });

    // Approvals for the marketplace to move funds at settlement time.
    await carbonToken.approve(
      marketplace.address,
      web3.utils.toWei("1000", "ether"),
      {
        from: seller,
      },
    );
    await paymentToken.approve(
      marketplace.address,
      web3.utils.toWei("100000", "ether"),
      {
        from: buyer,
      },
    );
  });

  describe("order placement guards", () => {
    it("rejects a sell order without sufficient token allowance", async () => {
      // Revoke the seller's allowance.
      await carbonToken.approve(marketplace.address, 0, { from: seller });

      await expectRevert(
        marketplace.placeOrder(
          OrderType.Limit,
          OrderSide.Sell,
          web3.utils.toWei("10", "ether"),
          web3.utils.toWei("2", "ether"),
          0,
          0,
          CURRENT_YEAR,
          ZERO_BYTES32,
          0,
          false,
          0,
          { from: seller },
        ),
      );
    });

    it("rejects a buy order without sufficient payment token allowance", async () => {
      await paymentToken.approve(marketplace.address, 0, { from: buyer });

      await expectRevert(
        marketplace.placeOrder(
          OrderType.Limit,
          OrderSide.Buy,
          web3.utils.toWei("10", "ether"),
          web3.utils.toWei("2", "ether"),
          0,
          0,
          CURRENT_YEAR,
          ZERO_BYTES32,
          0,
          false,
          0,
          { from: buyer },
        ),
      );
    });
  });

  describe("order matching and settlement", () => {
    it("matches a resting sell order against an incoming buy order and settles the trade", async () => {
      const amount = web3.utils.toWei("100", "ether");
      const price = web3.utils.toWei("2", "ether");

      await marketplace.placeOrder(
        OrderType.Limit,
        OrderSide.Sell,
        amount,
        price,
        0,
        0,
        CURRENT_YEAR,
        ZERO_BYTES32,
        0,
        false,
        0,
        { from: seller },
      );

      const receipt = await marketplace.placeOrder(
        OrderType.Limit,
        OrderSide.Buy,
        amount,
        price,
        0,
        0,
        CURRENT_YEAR,
        ZERO_BYTES32,
        0,
        false,
        0,
        { from: buyer },
      );

      assert.isTrue(receipt.logs.some((l) => l.event === "TradeExecuted"));
      assert.equal((await carbonToken.balanceOf(buyer)).toString(), amount);

      const marketData = await marketplace.getMarketData();
      assert.equal(marketData.lastPrice.toString(), price);
    });

    it("does not match orders for different vintage years", async () => {
      const amount = web3.utils.toWei("10", "ether");
      const price = web3.utils.toWei("2", "ether");

      await marketplace.placeOrder(
        OrderType.Limit,
        OrderSide.Sell,
        amount,
        price,
        0,
        0,
        CURRENT_YEAR,
        ZERO_BYTES32,
        0,
        false,
        0,
        { from: seller },
      );

      const receipt = await marketplace.placeOrder(
        OrderType.Limit,
        OrderSide.Buy,
        amount,
        price,
        0,
        0,
        CURRENT_YEAR - 1,
        ZERO_BYTES32,
        0,
        false,
        0,
        { from: buyer },
      );

      assert.isFalse(receipt.logs.some((l) => l.event === "TradeExecuted"));
      assert.equal((await carbonToken.balanceOf(buyer)).toString(), "0");
    });
  });

  describe("auctions", () => {
    beforeEach(async () => {
      await carbonToken.approve(
        marketplace.address,
        web3.utils.toWei("50", "ether"),
        {
          from: seller,
        },
      );
      await marketplace.createAuction(
        web3.utils.toWei("50", "ether"),
        web3.utils.toWei("1", "ether"),
        3600,
        CURRENT_YEAR,
        "Auction lot A",
        { from: seller },
      );
    });

    it("records the highest bid and bidder", async () => {
      await marketplace.placeBid(1, web3.utils.toWei("5", "ether"), {
        from: buyer,
      });

      const auction = await marketplace.getAuction(1);
      assert.equal(auction.highestBidder, buyer);
      assert.equal(
        auction.highestBid.toString(),
        web3.utils.toWei("5", "ether"),
      );
    });

    it("refunds the previous highest bidder when outbid", async () => {
      await paymentToken.mint(other, web3.utils.toWei("100000", "ether"), {
        from: admin,
      });
      await paymentToken.approve(
        marketplace.address,
        web3.utils.toWei("100000", "ether"),
        {
          from: other,
        },
      );

      await marketplace.placeBid(1, web3.utils.toWei("5", "ether"), {
        from: buyer,
      });

      const buyerBalanceBefore = await paymentToken.balanceOf(buyer);
      await marketplace.placeBid(1, web3.utils.toWei("8", "ether"), {
        from: other,
      });
      const buyerBalanceAfter = await paymentToken.balanceOf(buyer);

      assert.equal(
        buyerBalanceAfter.sub(buyerBalanceBefore).toString(),
        web3.utils.toWei("5", "ether"),
      );
    });

    it("rejects a bid below the reserve price", async () => {
      await expectRevert(
        marketplace.placeBid(1, web3.utils.toWei("0.5", "ether"), {
          from: buyer,
        }),
      );
    });
  });

  describe("liquidity pool", () => {
    it("mints pool shares proportional to the deposited amounts for the first provider", async () => {
      const carbonAmount = web3.utils.toWei("10", "ether");
      const paymentAmount = web3.utils.toWei("20", "ether");

      await carbonToken.approve(marketplace.address, carbonAmount, {
        from: seller,
      });
      await paymentToken.mint(seller, paymentAmount, { from: admin });
      await paymentToken.approve(marketplace.address, paymentAmount, {
        from: seller,
      });

      await marketplace.addLiquidity(carbonAmount, paymentAmount, {
        from: seller,
      });

      const shares = await marketplace.getLiquidityShares(seller);
      assert.isTrue(web3.utils.toBN(shares).gt(web3.utils.toBN("0")));
    });
  });
});
