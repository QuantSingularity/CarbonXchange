const AdvancedCarbonCreditToken = artifacts.require(
  "AdvancedCarbonCreditToken",
);

const { expectRevert } = require("./helpers/expectRevert");

contract("AdvancedCarbonCreditToken", (accounts) => {
  const [admin, verifier, developer, buyer, feeRecipient, other] = accounts;

  const TOTAL_CREDITS = web3.utils.toWei("10000", "ether");
  const CURRENT_YEAR = new Date().getFullYear();
  const METHODOLOGY = "VM0007";
  const STANDARD = "Verra";
  const DOC_HASH = web3.utils.keccak256("ipfs://project-docs");

  let token;

  beforeEach(async () => {
    token = await AdvancedCarbonCreditToken.new(
      "Advanced Carbon Credit",
      "ACCO2",
      admin,
      feeRecipient,
      { from: admin },
    );

    const VERIFIER_ROLE = await token.VERIFIER_ROLE();
    await token.grantRole(VERIFIER_ROLE, verifier, { from: admin });
  });

  async function registerAndVerifyProject() {
    await token.registerProject(
      "Reforestation Project A",
      METHODOLOGY,
      "Brazil",
      developer,
      CURRENT_YEAR,
      TOTAL_CREDITS,
      STANDARD,
      DOC_HASH,
      { from: admin },
    );
    await token.verifyProject(1, { from: verifier });
  }

  describe("project lifecycle", () => {
    it("registers a project in Pending status", async () => {
      await token.registerProject(
        "Reforestation Project A",
        METHODOLOGY,
        "Brazil",
        developer,
        CURRENT_YEAR,
        TOTAL_CREDITS,
        STANDARD,
        DOC_HASH,
        { from: admin },
      );

      const project = await token.getProject(1);
      assert.equal(project.developer, developer);
      assert.equal(project.isActive, false);
    });

    it("activates a project on verification, enabling issuance", async () => {
      // Regression test: verifyProject previously left the project in a
      // "Verified" status that issueCarbonCredits' onlyActiveProject
      // modifier never accepted, permanently blocking issuance.
      await registerAndVerifyProject();

      const project = await token.getProject(1);
      assert.equal(project.isActive, true);

      // Should not revert.
      await token.issueCarbonCredits(
        1,
        web3.utils.toWei("100", "ether"),
        "SN-0001",
        DOC_HASH,
        {
          from: admin,
        },
      );

      assert.equal(
        (await token.balanceOf(developer)).toString(),
        web3.utils.toWei("100", "ether"),
      );
    });

    it("rejects verification by an account without VERIFIER_ROLE", async () => {
      await token.registerProject(
        "P",
        METHODOLOGY,
        "Brazil",
        developer,
        CURRENT_YEAR,
        TOTAL_CREDITS,
        STANDARD,
        DOC_HASH,
        { from: admin },
      );
      await expectRevert(token.verifyProject(1, { from: other }));
    });
  });

  describe("issueCarbonCredits", () => {
    beforeEach(async () => {
      await registerAndVerifyProject();
    });

    it("mints credits to the project developer", async () => {
      const amount = web3.utils.toWei("500", "ether");
      await token.issueCarbonCredits(1, amount, "SN-0001", DOC_HASH, {
        from: admin,
      });
      assert.equal((await token.balanceOf(developer)).toString(), amount);
    });

    it("rejects issuance beyond the project's total credits", async () => {
      await expectRevert(
        token.issueCarbonCredits(
          1,
          web3.utils.toBN(TOTAL_CREDITS).add(web3.utils.toBN("1")).toString(),
          "SN-0001",
          DOC_HASH,
          { from: admin },
        ),
      );
    });

    it("rejects issuance for a blacklisted developer", async () => {
      const COMPLIANCE_ROLE = await token.COMPLIANCE_ROLE();
      await token.grantRole(COMPLIANCE_ROLE, admin, { from: admin });
      await token.blacklistUser(developer, "test", { from: admin });

      await expectRevert(
        token.issueCarbonCredits(
          1,
          web3.utils.toWei("100", "ether"),
          "SN-0001",
          DOC_HASH,
          {
            from: admin,
          },
        ),
      );
    });
  });

  describe("transfer fees", () => {
    beforeEach(async () => {
      await registerAndVerifyProject();
      await token.issueCarbonCredits(
        1,
        web3.utils.toWei("1000", "ether"),
        "SN-0001",
        DOC_HASH,
        {
          from: admin,
        },
      );
      await token.setFeeRates(10, 5, { from: admin }); // 0.10% transfer / 0.05% retirement
    });

    it("charges the transfer fee to the fee recipient and sends the net amount", async () => {
      const amount = web3.utils.toWei("1000", "ether");
      await token.transfer(buyer, amount, { from: developer });

      const fee = web3.utils
        .toBN(amount)
        .mul(web3.utils.toBN("10"))
        .div(web3.utils.toBN("10000"));
      const net = web3.utils.toBN(amount).sub(fee);

      assert.equal((await token.balanceOf(buyer)).toString(), net.toString());
      assert.equal(
        (await token.balanceOf(feeRecipient)).toString(),
        fee.toString(),
      );
    });
  });

  describe("compliance", () => {
    beforeEach(async () => {
      await registerAndVerifyProject();
      await token.issueCarbonCredits(
        1,
        web3.utils.toWei("1000", "ether"),
        "SN-0001",
        DOC_HASH,
        {
          from: admin,
        },
      );

      const COMPLIANCE_ROLE = await token.COMPLIANCE_ROLE();
      await token.grantRole(COMPLIANCE_ROLE, admin, { from: admin });
    });

    it("blocks transfers to a blacklisted address", async () => {
      await token.blacklistUser(buyer, "sanctions match", { from: admin });
      await expectRevert(
        token.transfer(buyer, web3.utils.toWei("1", "ether"), {
          from: developer,
        }),
      );
    });

    it("allows transfers again after removing a user from the blacklist", async () => {
      await token.blacklistUser(buyer, "sanctions match", { from: admin });
      await token.whitelistUser(buyer, { from: admin });
      await token.transfer(buyer, web3.utils.toWei("1", "ether"), {
        from: developer,
      });
      assert.isTrue(
        web3.utils.toBN(await token.balanceOf(buyer)).gt(web3.utils.toBN("0")),
      );
    });
  });

  describe("retireCredits", () => {
    beforeEach(async () => {
      await registerAndVerifyProject();
      await token.issueCarbonCredits(
        1,
        web3.utils.toWei("1000", "ether"),
        "SN-0001",
        DOC_HASH,
        {
          from: admin,
        },
      );
    });

    it("burns the retired credits and reduces the holder's balance", async () => {
      const balanceBefore = await token.balanceOf(developer);
      const amount = web3.utils.toWei("100", "ether");

      const receipt = await token.retireCredits(
        amount,
        "voluntary offset",
        "Acme Corp",
        {
          from: developer,
        },
      );

      const balanceAfter = await token.balanceOf(developer);
      assert.equal(balanceBefore.sub(balanceAfter).toString(), amount);
      assert.equal(
        receipt.logs.some((l) => l.event === "CreditsRetired"),
        true,
      );
    });

    it("rejects retiring more than the caller's balance", async () => {
      await expectRevert(
        token.retireCredits(web3.utils.toWei("100000", "ether"), "x", "y", {
          from: developer,
        }),
      );
    });
  });

  describe("pausing", () => {
    beforeEach(async () => {
      await registerAndVerifyProject();
      await token.issueCarbonCredits(
        1,
        web3.utils.toWei("100", "ether"),
        "SN-0001",
        DOC_HASH,
        {
          from: admin,
        },
      );
    });

    it("blocks transfers while paused and allows them again after unpausing", async () => {
      await token.pause({ from: admin });
      await expectRevert(
        token.transfer(buyer, web3.utils.toWei("1", "ether"), {
          from: developer,
        }),
      );

      await token.unpause({ from: admin });
      await token.transfer(buyer, web3.utils.toWei("1", "ether"), {
        from: developer,
      });
      assert.isTrue(
        web3.utils.toBN(await token.balanceOf(buyer)).gt(web3.utils.toBN("0")),
      );
    });

    it("rejects pause calls from an account without PAUSER_ROLE", async () => {
      await expectRevert(token.pause({ from: other }));
    });
  });

  describe("emergencyWithdraw", () => {
    it("lets an admin rescue ETH accidentally sent to the contract", async () => {
      await web3.eth.sendTransaction({
        from: admin,
        to: token.address,
        value: web3.utils.toWei("1", "ether"),
      });

      const adminBalanceBefore = web3.utils.toBN(
        await web3.eth.getBalance(admin),
      );
      const receipt = await token.emergencyWithdraw(
        "0x0000000000000000000000000000000000000000",
        web3.utils.toWei("1", "ether"),
        { from: admin },
      );
      const tx = await web3.eth.getTransaction(receipt.tx);
      const gasCost = web3.utils
        .toBN(receipt.receipt.gasUsed)
        .mul(web3.utils.toBN(tx.gasPrice));
      const adminBalanceAfter = web3.utils.toBN(
        await web3.eth.getBalance(admin),
      );

      assert.equal(
        adminBalanceAfter.toString(),
        adminBalanceBefore
          .sub(gasCost)
          .add(web3.utils.toBN(web3.utils.toWei("1", "ether")))
          .toString(),
      );
    });

    it("rejects emergencyWithdraw from a non-admin", async () => {
      await expectRevert(
        token.emergencyWithdraw(
          "0x0000000000000000000000000000000000000000",
          1,
          { from: other },
        ),
      );
    });
  });
});
