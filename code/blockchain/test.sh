#!/bin/bash

# Blockchain Test Script
# This script runs `truffle test` for the Solidity contracts.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
BLOCKCHAIN_DIR="$SCRIPT_DIR"

echo "Running blockchain tests in $BLOCKCHAIN_DIR..."

cd "$BLOCKCHAIN_DIR"

# Prefer the project's local Truffle install (from package.json) and fall
# back to a global install if present. This avoids requiring a global
# `npm install -g truffle` on every machine.
if [ -x "$BLOCKCHAIN_DIR/node_modules/.bin/truffle" ]; then
    TRUFFLE="$BLOCKCHAIN_DIR/node_modules/.bin/truffle"
elif command -v truffle &> /dev/null; then
    TRUFFLE="truffle"
else
    echo "Error: Truffle is not installed. Run 'npm install' in $BLOCKCHAIN_DIR first,"
    echo "or install Truffle globally (npm install -g truffle)."
    echo "You can also run the main setup script: setup_carbonxchange_env.sh"
    exit 1
fi

$TRUFFLE test

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "Blockchain tests passed successfully."
else
    echo "Blockchain tests failed. Exit code: $TEST_EXIT_CODE"
fi

exit $TEST_EXIT_CODE
