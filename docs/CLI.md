# CLI Reference

Complete reference for CarbonXchange command-line interface tools and automation scripts.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [CLI Commands](#cli-commands)
- [Environment Manager](#environment-manager)
- [Service Orchestrator](#service-orchestrator)
- [Test Runner](#test-runner)
- [Deployment Scripts](#deployment-scripts)
- [Data Management](#data-management)
- [Documentation Generator](#documentation-generator)
- [Utility Tools](#utility-tools)

## Overview

CarbonXchange provides a comprehensive set of CLI tools located in the `scripts/` directory. These tools streamline development, testing, deployment, and maintenance workflows.

**Script Organization:**

```
scripts/
├── dev_env/          # Environment setup and management
├── orchestration/    # Service control and monitoring
├── testing/          # Test execution and reporting
├── deployment/       # Deployment automation
├── data/             # Data backup and migration
├── docs/             # Documentation generation
├── maintenance/      # Cleanup and maintenance
└── tools/            # Utility scripts
```

## Installation

Make all scripts executable:

```bash
cd CarbonXchange
chmod +x scripts/**/*.sh
```

**Optional**: Add to PATH for global access:

```bash
echo 'export PATH="$PATH:$HOME/CarbonXchange/scripts/dev_env:$HOME/CarbonXchange/scripts/orchestration"' >> ~/.bashrc
source ~/.bashrc
```

## CLI Commands Summary

| Command                      | Description                      | Example                              |
| ---------------------------- | -------------------------------- | ------------------------------------ |
| `cx_env_manager.sh`          | Environment setup and validation | `./cx_env_manager.sh --all`          |
| `cx_service_orchestrator.sh` | Service management               | `./cx_service_orchestrator.sh start` |
| `cx_test_runner.sh`          | Run tests                        | `./cx_test_runner.sh --all`          |
| `cx_deploy.sh`               | Deploy to environments           | `./cx_deploy.sh deploy dev`          |
| `cx_data_manager.sh`         | Data operations                  | `./cx_data_manager.sh backup`        |
| `cx_docs_generator.sh`       | Generate documentation           | `./cx_docs_generator.sh --all`       |
| `cx_cleanup.sh`              | Clean build artifacts            | `./cx_cleanup.sh`                    |
| `cx_version.sh`              | Version management               | `./cx_version.sh --current`          |
| `cx_lint_all.sh`             | Run code linters                 | `./cx_lint_all.sh`                   |
| `cx_run_dev.sh`              | Quick start development          | `./cx_run_dev.sh`                    |

## Environment Manager

**Script**: `scripts/dev_env/cx_env_manager.sh`

Manage development environment setup, dependency installation, and configuration validation.

### Commands

| Command      | Description                 | Example                          |
| ------------ | --------------------------- | -------------------------------- |
| `--all`      | Set up complete environment | `./cx_env_manager.sh --all`      |
| `--check`    | Check system prerequisites  | `./cx_env_manager.sh --check`    |
| `--install`  | Install dependencies        | `./cx_env_manager.sh --install`  |
| `--update`   | Update dependencies         | `./cx_env_manager.sh --update`   |
| `--validate` | Validate configuration      | `./cx_env_manager.sh --validate` |
| `--help`     | Show help message           | `./cx_env_manager.sh --help`     |

### Usage Examples

**Complete setup (recommended for first-time setup):**

```bash
cd scripts/dev_env
./cx_env_manager.sh --all
```

This will:

1. Check system prerequisites (Python, Node.js, Git, PostgreSQL, Redis)
2. Install Python dependencies (from requirements.txt)
3. Install Node.js dependencies (from package.json)
4. Set up database
5. Configure environment variables
6. Validate configuration

**Check prerequisites only:**

```bash
./cx_env_manager.sh --check
```

Output example:

```
✓ Python 3.9.7 installed
✓ Node.js 16.13.0 installed
✓ npm 8.1.0 installed
✓ Git 2.34.1 installed
✓ PostgreSQL 14.1 installed
✗ Redis not installed (optional)
```

**Update dependencies:**

```bash
./cx_env_manager.sh --update
```

## Service Orchestrator

**Script**: `scripts/orchestration/cx_service_orchestrator.sh`

Unified service management for starting, stopping, and monitoring CarbonXchange services.

### Commands

| Command   | Arguments              | Description                           | Example                                        |
| --------- | ---------------------- | ------------------------------------- | ---------------------------------------------- |
| `start`   | [service]              | Start service(s)                      | `./cx_service_orchestrator.sh start backend`   |
| `stop`    | [service]              | Stop service(s)                       | `./cx_service_orchestrator.sh stop`            |
| `restart` | `<service>` (required) | Restart a specific service            | `./cx_service_orchestrator.sh restart backend` |
| `status`  | -                      | Check status of all services          | `./cx_service_orchestrator.sh status`          |
| `logs`    | `<service>` (required) | Tail a service's log (Ctrl+C to exit) | `./cx_service_orchestrator.sh logs backend`    |

### Service Names

- `backend` - Flask API server (port 5000)
- `blockchain` - Local Truffle/Ganache blockchain node (port 8545)
- `web_frontend` - Vite web application (port 5173)
- `mobile_frontend` - Expo/Metro mobile app (port 8081)
- (omit the service argument to `start`/`stop` to act on all of them)

### Usage Examples

**Start all services:**

```bash
cd scripts/orchestration
./cx_service_orchestrator.sh start
```

**Start specific service:**

```bash
./cx_service_orchestrator.sh start backend
```

**Check status:**

```bash
./cx_service_orchestrator.sh status
```

Output example:

```
backend: RUNNING (PID: 12345)
blockchain: RUNNING (PID: 12346)
web_frontend: RUNNING (PID: 12347)
mobile_frontend: STOPPED
```

**Tail backend logs:**

```bash
./cx_service_orchestrator.sh logs backend
```

**Restart the web frontend after code changes:**

```bash
./cx_service_orchestrator.sh restart web_frontend
```

**Stop all services:**

```bash
./cx_service_orchestrator.sh stop
```

## Test Runner

**Script**: `scripts/testing/cx_test_runner.sh`

Execute automated tests across every component, with an optional coverage report and git hook setup.

### Commands

| Command       | Arguments   | Description                                                              | Example                            |
| ------------- | ----------- | ------------------------------------------------------------------------ | ---------------------------------- |
| `unit`        | [component] | Run unit tests (all components, or just one)                             | `./cx_test_runner.sh unit backend` |
| `integration` | [component] | Run integration tests                                                    | `./cx_test_runner.sh integration`  |
| `e2e`         | -           | Run end-to-end tests (requires running services, needs a Cypress config) | `./cx_test_runner.sh e2e`          |
| `all`         | -           | Run unit + integration + e2e for every component                         | `./cx_test_runner.sh all`          |
| `coverage`    | -           | Generate coverage reports for every component                            | `./cx_test_runner.sh coverage`     |
| `hooks`       | -           | Install a git pre-commit hook (lint + unit tests)                        | `./cx_test_runner.sh hooks`        |

Valid component names for `unit`/`integration`: `backend`, `blockchain`, `web-frontend`, `mobile-frontend`, `ai-models`.

### Usage Examples

**Run everything:**

```bash
cd scripts/testing
./cx_test_runner.sh all
```

**Run only backend unit tests:**

```bash
./cx_test_runner.sh unit backend
```

**Generate coverage reports:**

```bash
./cx_test_runner.sh coverage
```

**Install the pre-commit hook:**

```bash
./cx_test_runner.sh hooks
```

Output example:

```
Running CarbonXchange Tests
============================

Backend Tests:
  ✓ test_user_registration (0.23s)
  ✓ test_user_login (0.18s)
  ✓ test_create_order (0.45s)
  ✓ test_order_matching (0.67s)
  ✓ test_portfolio_calculation (0.34s)

Frontend Tests:
  ✓ renders dashboard (0.12s)
  ✓ displays market data (0.15s)

Smart Contract Tests:
  ✓ mints tokens correctly (1.23s)
  ✓ transfers tokens (0.89s)

============================
Results: 156 passed, 0 failed
Coverage: 81%
Time: 45.2s
```

## Deployment Scripts

**Script**: `scripts/deployment/cx_deploy.sh`

Automate deployment to different environments with rollback capabilities.

### Commands

| Command    | Arguments | Description                                    | Example                              |
| ---------- | --------- | ---------------------------------------------- | ------------------------------------ |
| `build`    | `<env>`   | Generate config and build all components       | `./cx_deploy.sh build dev`           |
| `deploy`   | `<env>`   | Deploy the latest build to the environment     | `./cx_deploy.sh deploy production`   |
| `validate` | `<env>`   | Run post-deployment validation checks          | `./cx_deploy.sh validate production` |
| `rollback` | `<env>`   | Rollback to the previous successful deployment | `./cx_deploy.sh rollback production` |
| `all`      | `<env>`   | Run build, deploy, and validate sequentially   | `./cx_deploy.sh all production`      |

### Environments

- `dev` - Development environment
- `staging` - Staging/pre-production
- `production` - Production environment

### Usage Examples

**Deploy to development:**

```bash
cd scripts/deployment
./cx_deploy.sh deploy dev
```

**Deploy to production (with confirmation):**

```bash
./cx_deploy.sh deploy production
```

Output:

```
⚠️  WARNING: Deploying to PRODUCTION environment
Current version: 1.0.0
New version: 1.0.1

This will:
- Build and push Docker images
- Update Kubernetes deployments
- Run database migrations
- Restart services

Are you sure? (yes/no): yes

Deploying...
✓ Building Docker images
✓ Pushing to registry
✓ Updating deployments
✓ Running migrations
✓ Health check passed

Deployment successful!
Version 1.0.1 deployed to production
```

**Rollback if issues occur:**

```bash
./cx_deploy.sh rollback production
```

**Run post-deployment validation:**

```bash
./cx_deploy.sh validate production
```

## Data Management

**Script**: `scripts/data/cx_data_manager.sh`

Manage database backups, restores, and data operations.

### Commands

| Command   | Arguments        | Description             | Example                                                     |
| --------- | ---------------- | ----------------------- | ----------------------------------------------------------- |
| `backup`  | [filename]       | Backup database         | `./cx_data_manager.sh backup`                               |
| `restore` | <filename>       | Restore from backup     | `./cx_data_manager.sh restore backup.sql`                   |
| `export`  | <type> <options> | Export data             | `./cx_data_manager.sh export market-data --output data.csv` |
| `import`  | <type> <file>    | Import data             | `./cx_data_manager.sh import seed-data data.json`           |
| `migrate` | -                | Run database migrations | `./cx_data_manager.sh migrate`                              |
| `seed`    | -                | Seed test data          | `./cx_data_manager.sh seed`                                 |

### Usage Examples

**Backup database:**

```bash
cd scripts/data
./cx_data_manager.sh backup
```

Output: `carbonxchange_backup_2024-01-20_153000.sql`

**Backup with custom filename:**

```bash
./cx_data_manager.sh backup production_backup_v1.0.sql
```

**Restore from backup:**

```bash
./cx_data_manager.sh restore carbonxchange_backup_2024-01-20_153000.sql
```

**Export market data to CSV:**

```bash
./cx_data_manager.sh export market-data --output market_data.csv --start-date 2024-01-01 --end-date 2024-01-31
```

**Import seed data:**

```bash
./cx_data_manager.sh import seed-data test_data.json
```

## Documentation Generator

**Script**: `scripts/docs/cx_docs_generator.sh`

Generate API documentation, changelogs, and project reports.

### Commands

| Command       | Description                | Example                              |
| ------------- | -------------------------- | ------------------------------------ |
| `--all`       | Generate all documentation | `./cx_docs_generator.sh --all`       |
| `--api`       | Generate API docs only     | `./cx_docs_generator.sh --api`       |
| `--changelog` | Generate changelog         | `./cx_docs_generator.sh --changelog` |
| `--status`    | Project status report      | `./cx_docs_generator.sh --status`    |

### Usage Examples

**Generate all documentation:**

```bash
cd scripts/docs
./cx_docs_generator.sh --all
```

**Generate API documentation:**

```bash
./cx_docs_generator.sh --api
```

Output: `docs/api-reference.html`

## Utility Tools

### Code Linting

**Script**: `scripts/tools/cx_lint_all.sh`

Run code linters and formatters across the codebase.

```bash
cd scripts/tools
./cx_lint_all.sh
```

This runs:

- Python: `black`, `flake8`, `pylint`
- JavaScript/TypeScript: `eslint`, `prettier`
- Solidity: `solhint`

### Version Management

**Script**: `scripts/tools/cx_version.sh`

Manage project version numbers.

| Command         | Description             | Example                        |
| --------------- | ----------------------- | ------------------------------ |
| `--current`     | Display current version | `./cx_version.sh --current`    |
| `--bump <type>` | Bump version            | `./cx_version.sh --bump patch` |

**Bump types:**

- `patch` - 1.0.0 → 1.0.1 (bug fixes)
- `minor` - 1.0.0 → 1.1.0 (new features)
- `major` - 1.0.0 → 2.0.0 (breaking changes)

```bash
# Display current version
./cx_version.sh --current

# Bump patch version
./cx_version.sh --bump patch
```

### Maintenance and Cleanup

**Script**: `scripts/maintenance/cx_cleanup.sh`

Clean build artifacts, temporary files, and caches.

```bash
cd scripts/maintenance
./cx_cleanup.sh
```

This removes:

- Python `__pycache__` directories
- Node.js `node_modules` (optional)
- Build artifacts in `dist/`, `build/`
- Log files (optional)
- Docker unused images (optional)

### Quick Development Start

**Script**: `scripts/orchestration/cx_run_dev.sh`

Quick start script for development (combines multiple commands).

```bash
./scripts/orchestration/cx_run_dev.sh
```

This script:

1. Checks environment
2. Starts database and Redis
3. Runs database migrations
4. Starts backend API
5. Starts frontend dev server
6. Opens browser to http://localhost:3000

## Environment Variables

Many CLI scripts respect environment variables for configuration:

| Variable           | Description         | Default                    | Example            |
| ------------------ | ------------------- | -------------------------- | ------------------ |
| `CX_ENV`           | Current environment | `development`              | `production`       |
| `CX_PORT`          | Backend API port    | `5000`                     | `8080`             |
| `CX_FRONTEND_PORT` | Frontend port       | `3000`                     | `3001`             |
| `CX_DB_URL`        | Database URL        | sqlite:///dev.db           | `postgresql://...` |
| `CX_REDIS_URL`     | Redis URL           | `redis://localhost:6379/0` | `redis://...`      |
| `CX_LOG_LEVEL`     | Log level           | `INFO`                     | `DEBUG`            |

**Usage:**

```bash
export CX_ENV=staging
export CX_PORT=8080
./scripts/orchestration/cx_service_orchestrator.sh start backend
```

## Aliases (Optional)

Add these aliases to `~/.bashrc` or `~/.zshrc` for faster access:

```bash
# CarbonXchange CLI aliases
alias cx-start='./scripts/orchestration/cx_service_orchestrator.sh start'
alias cx-stop='./scripts/orchestration/cx_service_orchestrator.sh stop'
alias cx-restart='./scripts/orchestration/cx_service_orchestrator.sh restart'
alias cx-status='./scripts/orchestration/cx_service_orchestrator.sh status'
alias cx-logs='./scripts/orchestration/cx_service_orchestrator.sh logs'
alias cx-test='./scripts/testing/cx_test_runner.sh --all'
alias cx-lint='./scripts/tools/cx_lint_all.sh'
alias cx-backup='./scripts/data/cx_data_manager.sh backup'
```

Then use:

```bash
cx-start        # Start all services
cx-status       # Check status
cx-logs backend # View backend logs
cx-test         # Run tests
```

## Next Steps

- Review [Usage Guide](USAGE.md) for common workflows
- Check [API Reference](API.md) for endpoint details
- See [Configuration](CONFIGURATION.md) for environment variables
- Read [Troubleshooting](TROUBLESHOOTING.md) for script issues
