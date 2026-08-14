async function expectRevert(promise) {
  try {
    await promise;
  } catch (error) {
    const revertsAsExpected =
      /revert/i.test(error.message) ||
      /VM Exception/i.test(error.message) ||
      /reverted/i.test(error.message);
    if (!revertsAsExpected) {
      throw new Error(
        `Expected the transaction to revert, but it failed with an unexpected error: ${error.message}`,
      );
    }
    return;
  }
  throw new Error("Expected the transaction to revert, but it succeeded");
}

module.exports = { expectRevert };
