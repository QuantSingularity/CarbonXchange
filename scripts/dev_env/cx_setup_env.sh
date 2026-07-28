#!/bin/bash

# CarbonXchange Environment Setup Script
# A simple wrapper to run the comprehensive environment setup using the environment manager.

set -euo pipefail

# ANSI color codes for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory and Project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Path to the environment manager script
ENV_MANAGER_SCRIPT="$SCRIPT_DIR/cx_env_manager.sh"

# Function to log messages
log() {
    local level=$1
    local message=$2
    local color=$NC

    case $level in
        "INFO") color=$GREEN ;;
        "ERROR") color=$RED ;;
        "STEP") color=$BLUE ;;
    esac

    echo -e "${color}[$level] $message${NC}" >&2
}

# Check if the environment manager script exists
if [ ! -f "$ENV_MANAGER_SCRIPT" ]; then
    log "ERROR" "Environment manager script not found at $ENV_MANAGER_SCRIPT. Please check your scripts directory."
    exit 1
fi

log "STEP" "Starting CarbonXchange environment setup..."

# Execute the environment manager's setup command
if "$ENV_MANAGER_SCRIPT" setup; then
    log "INFO" "CarbonXchange environment setup completed successfully."
else
    log "ERROR" "CarbonXchange environment setup failed. Check the logs for details."
    exit 1
fi
