#!/bin/bash

# CarbonXchange Linting and Formatting Script
# This script runs code quality checks and formatting across all project components.
# It assumes all necessary linters (black, isort, flake8, pylint, eslint, prettier, solhint, yamllint, terraform)
# are installed and available in the environment (e.g., in the project's virtual environment or globally).

set -euo pipefail # Exit on error, treat unset variables as error, and fail if any command in a pipeline fails

# ANSI color codes for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory and Project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Function to log messages
log() {
    local level=$1
    local message=$2
    local color=$NC

    case $level in
        "INFO") color=$GREEN ;;
        "WARNING") color=$YELLOW ;;
        "ERROR") color=$RED ;;
        "STEP") color=$BLUE ;;
    esac

    echo -e "${color}[$level] $message${NC}" >&2
}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Define directories to process (relative to PROJECT_ROOT)
PYTHON_DIRECTORIES=(
  "code/backend/src"
  "code/backend/tests"
  "code/ai_models"
)

JS_PROJECT_DIRECTORIES=(
  "web-frontend"
  "mobile-frontend"
)

SOLIDITY_DIRECTORIES=(
  "code/blockchain/contracts"
)

YAML_DIRECTORIES=(
  "infrastructure/kubernetes"
  "infrastructure/ansible"
  ".github/workflows"
)

TERRAFORM_DIRECTORIES=(
  "infrastructure/terraform"
)

# -----------------------------------------------------------------------------
# Main Execution
# -----------------------------------------------------------------------------

log "STEP" "Starting comprehensive linting and formatting for CarbonXchange..."

# 1. Python Linting
log "STEP" "Running Python linting tools..."
cd "$PROJECT_ROOT"

# Activate virtual environment if it exists
if [ -d "$PROJECT_ROOT/venv" ]; then
    source "$PROJECT_ROOT/venv/bin/activate"
    log "INFO" "Activated Python virtual environment."
fi

# 1.1 Run Black (code formatter)
if command_exists black; then
    log "INFO" "Running Black code formatter..."
    black "${PYTHON_DIRECTORIES[@]}" || log "WARNING" "Black encountered issues. Review output."
else
    log "WARNING" "Black not found. Skipping Python formatting."
fi

# 1.2 Run isort (import sorter)
if command_exists isort; then
    log "INFO" "Running isort to sort imports..."
    isort "${PYTHON_DIRECTORIES[@]}" || log "WARNING" "isort encountered issues. Review output."
else
    log "WARNING" "isort not found. Skipping import sorting."
fi

# 1.3 Run flake8 (linter)
if command_exists flake8; then
    log "INFO" "Running flake8 linter..."
    flake8 "${PYTHON_DIRECTORIES[@]}" || log "WARNING" "Flake8 found issues. Review output."
else
    log "WARNING" "flake8 not found. Skipping flake8 linting."
fi

# 1.4 Run pylint (more comprehensive linter)
if command_exists pylint; then
    log "INFO" "Running pylint for more comprehensive linting..."
    # Using find and xargs (NUL-delimited) for safe handling of many files
    find "${PYTHON_DIRECTORIES[@]}" -type f -name "*.py" -print0 | xargs -0 --no-run-if-empty pylint || log "WARNING" "Pylint found issues. Review output."
else
    log "WARNING" "pylint not found. Skipping pylint linting."
fi

# Deactivate virtual environment
if [ -d "$PROJECT_ROOT/venv" ]; then
    deactivate
fi

# 2. JavaScript/TypeScript Linting
log "STEP" "Running JavaScript/TypeScript linting tools..."

# Run each frontend's own local ESLint via npx rather than a single global
# eslint binary. This matters here specifically: web-frontend uses ESLint's
# modern flat config (eslint.config.js) while mobile-frontend uses the
# legacy .eslintrc.js format, and a single globally-installed ESLint version
# cannot correctly satisfy both config generations at once. Using npx also
# ensures each project's own local plugins (declared in its own
# package.json) resolve correctly.
for js_dir in "${JS_PROJECT_DIRECTORIES[@]}"; do
    js_dir_path="$PROJECT_ROOT/$js_dir"
    if [ ! -d "$js_dir_path" ]; then
        log "WARNING" "$js_dir not found. Skipping."
        continue
    fi
    if [ ! -f "$js_dir_path/package.json" ]; then
        log "WARNING" "$js_dir has no package.json. Skipping."
        continue
    fi

    log "INFO" "Running ESLint for $js_dir..."
    (cd "$js_dir_path" && npx --no-install eslint . --fix) || log "WARNING" "ESLint found issues in $js_dir. Review output."
done

# 3. Solidity Linting
log "STEP" "Running Solidity linting tools..."

# 3.1 Run Prettier on Solidity files
if command_exists prettier; then
    log "INFO" "Running Prettier for Solidity files..."
    for sol_dir in "${SOLIDITY_DIRECTORIES[@]}"; do
        if [ -d "$sol_dir" ]; then
            prettier --write "$sol_dir/**/*.sol" || log "WARNING" "Prettier encountered issues in $sol_dir. Review output."
        fi
    done
else
    log "WARNING" "prettier not found. Skipping Solidity formatting."
fi

# 3.2 Run solhint
if command_exists solhint; then
    log "INFO" "Running solhint for Solidity files..."
    for sol_dir in "${SOLIDITY_DIRECTORIES[@]}"; do
        if [ -d "$sol_dir" ]; then
            solhint "$sol_dir/**/*.sol" || log "WARNING" "solhint found issues in $sol_dir. Review output."
        fi
    done
else
    log "WARNING" "solhint not found. Skipping Solidity linting."
fi

# 4. YAML Linting
log "STEP" "Running YAML linting tools..."

# 4.1 Run yamllint
if command_exists yamllint; then
    log "INFO" "Running yamllint for YAML files..."
    yamllint -c "$PROJECT_ROOT/infrastructure/.yamllint" "${YAML_DIRECTORIES[@]}" || log "WARNING" "yamllint found issues. Review output."
else
    log "WARNING" "yamllint not found. Skipping YAML linting."
fi

# 5. Terraform Linting
log "STEP" "Running Terraform linting tools..."

# 5.1 Run terraform fmt
if command_exists terraform; then
    log "INFO" "Running terraform fmt for Terraform files..."
    for dir in "${TERRAFORM_DIRECTORIES[@]}"; do
        if [ -d "$dir" ]; then
            (cd "$dir" && terraform fmt -recursive) || log "WARNING" "terraform fmt encountered issues in $dir. Review output."
        fi
    done
    log "INFO" "terraform fmt completed."

    # 5.2 Run terraform validate
    log "INFO" "Running terraform validate for Terraform files..."
    for dir in "${TERRAFORM_DIRECTORIES[@]}"; do
        if [ -d "$dir" ]; then
            # terraform init is required before validate
            (cd "$dir" && terraform init -backend=false && terraform validate) || log "WARNING" "terraform validate encountered issues in $dir. Review output."
        fi
    done
    log "INFO" "terraform validate completed."
else
    log "WARNING" "terraform not found. Skipping Terraform linting."
fi

# 6. Ansible Linting
log "STEP" "Running Ansible linting tools..."

if command_exists ansible-lint; then
    ansible_dir="$PROJECT_ROOT/infrastructure/ansible"
    if [ ! -d "$ansible_dir" ]; then
        log "WARNING" "$ansible_dir not found. Skipping."
    elif [ ! -f "$ansible_dir/.vault_pass" ]; then
        log "WARNING" "$ansible_dir/.vault_pass not found. Create it (see infrastructure/README.md) to enable Ansible linting. Skipping."
    else
        log "INFO" "Running ansible-lint for playbooks and roles..."
        (cd "$ansible_dir" && ansible-lint playbooks/ roles/) || log "WARNING" "ansible-lint found issues. Review output."
    fi
else
    log "WARNING" "ansible-lint not found. Skipping Ansible linting."
fi

log "STEP" "Linting and formatting process completed. Review warnings/errors above."
