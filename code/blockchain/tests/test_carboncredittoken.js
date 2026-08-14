const CarbonCreditToken = artifacts.require("CarbonCreditToken");

const { expectRevert } = require("./helpers/expectRevert");

contract("CarbonCreditToken", (accounts) => {
  const [owner, alice, bob] = accounts;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  let token;

  beforeEach(async () => {
    token = await CarbonCreditToken.new(owner, { from: owner });
  });

  it("mints the initial supply of 1,000,000 tokens to the deployer", async () => {
    const balance = await token.balanceOf(owner);
    assert.equal(balance.toString(), web3.utils.toWei("1000000", "ether"));
  });

  it("sets the expected name, symbol and decimals", async () => {
    assert.equal(await token.name(), "CarbonCredit");
    assert.equal(await token.symbol(), "CCO2");
    assert.equal((await token.decimals()).toString(), "18");
  });

  it("sets the deployer-provided address as owner", async () => {
    assert.equal(await token.owner(), owner);
  });

  describe("mint", () => {
    it("allows the owner to mint new tokens", async () => {
      const amount = web3.utils.toWei("500", "ether");
      const receipt = await token.mint(alice, amount, { from: owner });

      assert.equal((await token.balanceOf(alice)).toString(), amount);
      assert.equal(receipt.logs[0].event, "CreditsMinted");
      assert.equal(receipt.logs[0].args.to, alice);
      assert.equal(receipt.logs[0].args.amount.toString(), amount);
    });

    it("rejects mint calls from a non-owner", async () => {
      await expectRevert(
        token.mint(alice, web3.utils.toWei("10", "ether"), { from: alice }),
      );
    });

    it("rejects minting to the zero address", async () => {
      await expectRevert(
        token.mint(ZERO_ADDRESS, web3.utils.toWei("10", "ether"), {
          from: owner,
        }),
      );
    });

    it("rejects minting a zero amount", async () => {
      await expectRevert(token.mint(alice, 0, { from: owner }));
    });
  });

  describe("burn", () => {
    it("allows a holder to burn their own tokens", async () => {
      const amount = web3.utils.toWei("100", "ether");
      await token.mint(alice, amount, { from: owner });

      await token.burn(amount, { from: alice });

      assert.equal((await token.balanceOf(alice)).toString(), "0");
    });
  });

  describe("standard ERC20 behaviour", () => {
    it("transfers tokens between accounts", async () => {
      const amount = web3.utils.toWei("50", "ether");
      await token.transfer(alice, amount, { from: owner });
      assert.equal((await token.balanceOf(alice)).toString(), amount);
    });

    it("supports approve + transferFrom", async () => {
      const amount = web3.utils.toWei("20", "ether");
      await token.approve(bob, amount, { from: owner });
      await token.transferFrom(owner, alice, amount, { from: bob });
      assert.equal((await token.balanceOf(alice)).toString(), amount);
    });
  });
});
