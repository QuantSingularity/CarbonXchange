# Contract ABIs for containerized deployment

`code/backend/src/services/blockchain_service.py` needs the compiled ABI
JSON files for `AdvancedCarbonCreditToken` and `AdvancedMarketplace` to
build real on-chain transactions.

In a monorepo checkout (local dev, CI), it finds them automatically at
`code/blockchain/build/contracts/*.json` (Truffle's default output
location). It walks up from its own file path to find the repo root, so
this only works when `code/backend` and `code/blockchain` are checked out
together as siblings.

**Docker images only build from the `code/backend` directory** (see
`docker-compose.yml`'s `context: .` and
`infrastructure/docker-compose.yml`'s `context: ../code/backend`), so
`code/blockchain` is never available inside the image. To make blockchain
calls work in a deployed container:

1. Compile the contracts once, from the repo root:

   ```bash
   cd code/blockchain
   npm install
   npx truffle compile
   ```

2. Copy the two ABI files this service needs into this directory:

   ```bash
   cp code/blockchain/build/contracts/AdvancedCarbonCreditToken.json \
      code/backend/contracts_abi/
   cp code/blockchain/build/contracts/AdvancedMarketplace.json \
      code/backend/contracts_abi/
   ```

3. Build the backend image as usual. Both `Dockerfile` and
   `infrastructure/docker/Dockerfile.backend` copy this directory into the
   image at `/app/contracts_abi`.

4. Set `CONTRACT_ABI_DIR=/app/contracts_abi` in the container's
   environment (see `.env.example`). This takes priority over the
   monorepo-relative lookup, so the service finds the ABIs regardless of
   how the image was built.

If you don't need real on-chain calls (e.g. local development, CI, or
`FEATURE_BLOCKCHAIN_INTEGRATION=false`), you can skip all of this - the
service falls back to simulation mode automatically when it can't find a
contract address, ABI, or RPC endpoint.

This directory is intentionally checked in with just this README so the
`COPY contracts_abi/ ./contracts_abi/` step in both Dockerfiles never fails
on a clean checkout; the actual `*.json` ABI files are build artifacts and
should not be committed (see `code/blockchain/.gitignore`).
