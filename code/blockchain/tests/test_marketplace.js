const CarbonCreditToken = artifacts.require("CarbonCreditToken");
const Marketplace = artifacts.require("Marketplace");

const { expectRevert } = require("./helpers/expectRevert");

contract("Marketplace", (accounts) => {
  const [owner, alice, bob] = accounts;

  const ONE_TOKEN = web3.utils.toWei("1", "ether");
  const PRICE_PER_TOKEN = web3.utils.toWei("0.01", "ether"); // price is per whole token

  let token;
  let marketplace;

  beforeEach(async () => {
    token = await CarbonCreditToken.new(owner, { from: owner });
    marketplace = await Marketplace.new(token.address, { from: owner });

    // Give alice tokens to sell and approve the marketplace to escrow them.
    await token.mint(alice, web3.utils.toWei("1000", "ether"), { from: owner });
    await token.approve(
      marketplace.address,
      web3.utils.toWei("1000", "ether"),
      {
        from: alice,
      },
    );
  });

  function cost(amountWei, pricePerTokenWei) {
    return web3.utils
      .toBN(amountWei)
      .mul(web3.utils.toBN(pricePerTokenWei))
      .div(web3.utils.toBN(web3.utils.toWei("1", "ether")));
  }

  describe("createListing", () => {
    it("escrows the seller's tokens in the marketplace contract", async () => {
      const amount = web3.utils.toWei("100", "ether");

      const aliceBalanceBefore = await token.balanceOf(alice);
      await marketplace.createListing(amount, PRICE_PER_TOKEN, { from: alice });

      assert.equal(
        (await token.balanceOf(alice)).toString(),
        aliceBalanceBefore.sub(web3.utils.toBN(amount)).toString(),
      );
      assert.equal(
        (await token.balanceOf(marketplace.address)).toString(),
        amount,
      );

      const listing = await marketplace.listings(0);
      assert.equal(listing.seller, alice);
      assert.equal(listing.amount.toString(), amount);
      assert.equal(listing.active, true);
    });

    it("rejects a zero amount", async () => {
      await expectRevert(
        marketplace.createListing(0, PRICE_PER_TOKEN, { from: alice }),
      );
    });

    it("rejects a zero price", async () => {
      await expectRevert(
        marketplace.createListing(web3.utils.toWei("10", "ether"), 0, {
          from: alice,
        }),
      );
    });

    it("rejects listing without prior token approval", async () => {
      await token.mint(bob, web3.utils.toWei("10", "ether"), { from: owner });
      await expectRevert(
        marketplace.createListing(
          web3.utils.toWei("10", "ether"),
          PRICE_PER_TOKEN,
          {
            from: bob,
          },
        ),
      );
    });
  });

  describe("buyCredits", () => {
    beforeEach(async () => {
      await marketplace.createListing(
        web3.utils.toWei("100", "ether"),
        PRICE_PER_TOKEN,
        {
          from: alice,
        },
      );
    });

    it("transfers the purchased tokens to the buyer and decrements the listing", async () => {
      const buyAmount = web3.utils.toWei("40", "ether");
      const price = cost(buyAmount, PRICE_PER_TOKEN);

      await marketplace.buyCredits(0, buyAmount, {
        from: bob,
        value: price,
      });

      assert.equal((await token.balanceOf(bob)).toString(), buyAmount);

      const listing = await marketplace.listings(0);
      assert.equal(
        listing.amount.toString(),
        web3.utils
          .toBN(web3.utils.toWei("100", "ether"))
          .sub(web3.utils.toBN(buyAmount))
          .toString(),
      );
      assert.equal(listing.active, true);
    });

    it("pays the seller the correct ETH amount", async () => {
      const buyAmount = web3.utils.toWei("40", "ether");
      const price = cost(buyAmount, PRICE_PER_TOKEN);

      const aliceBalanceBefore = web3.utils.toBN(
        await web3.eth.getBalance(alice),
      );
      await marketplace.buyCredits(0, buyAmount, { from: bob, value: price });
      const aliceBalanceAfter = web3.utils.toBN(
        await web3.eth.getBalance(alice),
      );

      assert.equal(
        aliceBalanceAfter.sub(aliceBalanceBefore).toString(),
        price.toString(),
      );
    });

    it("refunds any ETH sent above the required cost", async () => {
      const buyAmount = web3.utils.toWei("10", "ether");
      const price = cost(buyAmount, PRICE_PER_TOKEN);
      const overpay = price.add(
        web3.utils.toBN(web3.utils.toWei("1", "ether")),
      );

      const bobBalanceBefore = web3.utils.toBN(await web3.eth.getBalance(bob));
      const receipt = await marketplace.buyCredits(0, buyAmount, {
        from: bob,
        value: overpay,
      });

      const tx = await web3.eth.getTransaction(receipt.tx);
      const gasCost = web3.utils
        .toBN(receipt.receipt.gasUsed)
        .mul(web3.utils.toBN(tx.gasPrice));
      const bobBalanceAfter = web3.utils.toBN(await web3.eth.getBalance(bob));

      const expectedBalanceAfter = bobBalanceBefore
        .sub(overpay)
        .sub(gasCost)
        .add(overpay.sub(price));

      assert.equal(bobBalanceAfter.toString(), expectedBalanceAfter.toString());
    });

    it("marks the listing inactive once fully sold", async () => {
      const fullAmount = web3.utils.toWei("100", "ether");
      const price = cost(fullAmount, PRICE_PER_TOKEN);

      await marketplace.buyCredits(0, fullAmount, { from: bob, value: price });

      const listing = await marketplace.listings(0);
      assert.equal(listing.amount.toString(), "0");
      assert.equal(listing.active, false);
    });

    it("rejects purchases that exceed the remaining listing amount", async () => {
      const tooMuch = web3.utils.toWei("1000", "ether");
      const price = cost(tooMuch, PRICE_PER_TOKEN);
      await expectRevert(
        marketplace.buyCredits(0, tooMuch, { from: bob, value: price }),
      );
    });

    it("rejects underpayment", async () => {
      const buyAmount = web3.utils.toWei("10", "ether");
      const price = cost(buyAmount, PRICE_PER_TOKEN);
      const underpay = price.sub(web3.utils.toBN("1"));
      await expectRevert(
        marketplace.buyCredits(0, buyAmount, { from: bob, value: underpay }),
      );
    });

    it("rejects purchases against an invalid listing id", async () => {
      await expectRevert(
        marketplace.buyCredits(99, web3.utils.toWei("1", "ether"), {
          from: bob,
          value: web3.utils.toWei("1", "ether"),
        }),
      );
    });
  });

  describe("cancelListing", () => {
    beforeEach(async () => {
      await marketplace.createListing(
        web3.utils.toWei("100", "ether"),
        PRICE_PER_TOKEN,
        {
          from: alice,
        },
      );
    });

    it("returns the unsold escrowed tokens to the seller", async () => {
      const aliceBalanceBefore = await token.balanceOf(alice);

      await marketplace.cancelListing(0, { from: alice });

      const aliceBalanceAfter = await token.balanceOf(alice);
      assert.equal(
        aliceBalanceAfter.sub(aliceBalanceBefore).toString(),
        web3.utils.toWei("100", "ether"),
      );

      const listing = await marketplace.listings(0);
      assert.equal(listing.amount.toString(), "0");
      assert.equal(listing.active, false);
    });

    it("only returns the remaining amount after a partial purchase", async () => {
      const buyAmount = web3.utils.toWei("30", "ether");
      const price = cost(buyAmount, PRICE_PER_TOKEN);
      await marketplace.buyCredits(0, buyAmount, { from: bob, value: price });

      const aliceBalanceBefore = await token.balanceOf(alice);
      await marketplace.cancelListing(0, { from: alice });
      const aliceBalanceAfter = await token.balanceOf(alice);

      assert.equal(
        aliceBalanceAfter.sub(aliceBalanceBefore).toString(),
        web3.utils.toWei("70", "ether"),
      );
    });

    it("rejects cancellation by a non-seller", async () => {
      await expectRevert(marketplace.cancelListing(0, { from: bob }));
    });

    it("rejects cancelling an already-cancelled listing", async () => {
      await marketplace.cancelListing(0, { from: alice });
      await expectRevert(marketplace.cancelListing(0, { from: alice }));
    });
  });
});
