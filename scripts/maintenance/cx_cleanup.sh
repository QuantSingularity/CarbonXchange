#!/bin/bash
# CarbonXchange Cleanup Script
# A utility script to clean up build artifacts, temporary files, and dependencies.

set -euo pipefail

# ANSI color codes for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Project root (assuming script is in a subdirectory of the project)
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Directories to clean (relative to PROJECT_ROOT)
CLEAN_DIRS=(
    "venv"
    "node_modules"
    "logs"
    ".pids"
    "deploy"
    "test-reports"
    "generated-docs"
    "code/backend/venv"
    "code/backend/node_modules"
    "code/blockchain/node_modules"
    "web-frontend/node_modules"
    "web-frontend/dist"
    "web-frontend/build"
    "mobile-frontend/node_modules"
    "mobile-frontend/web-build"
    "mobile-frontend/.expo"
    "mobile-frontend/android"
    "mobile-frontend/ios"
)

# Files to clean (relative to PROJECT_ROOT)
CLEAN_FILES=(
    "package-lock.json"
    "yarn.lock"
    "npm-debug.log"
    "cx_env_setup.log"
    "coverage.xml"
    "coverage.json"
    "coverage-summary.json"
    "code/backend/.coverage"
)

# Function to log messages
log() {
    local level="$1"
    local message="$2"
    local color="$NC"

    case "$level" in
        "INFO") color="$GREEN" ;;
        "WARNING") color="$YELLOW" ;;
        "ERROR") color="$RED" ;;
        "STEP") color="$BLUE" ;;
    esac

    echo -e "${color}[$level] $message${NC}" >&2
}

# Function to remove directories
remove_dirs() {
    log "STEP" "Removing directories..."
    for dir in "${CLEAN_DIRS[@]}"; do
        local full_path="$PROJECT_ROOT/$dir"
        if [ -d "$full_path" ]; then
            log "INFO" "Removing directory: $dir"
            rm -rf "$full_path"
        else
            log "WARNING" "Directory not found: $dir"
        fi
    done
}

# Function to remove files
remove_files() {
    log "STEP" "Removing files..."
    for file in "${CLEAN_FILES[@]}"; do
        local full_path="$PROJECT_ROOT/$file"
        if [ -f "$full_path" ]; then
            log "INFO" "Removing file: $file"
            rm -f "$full_path"
        else
            log "WARNING" "File not found: $file"
        fi
    done
}

# Function to clean all
clean_all() {
    log "STEP" "Starting full cleanup of CarbonXchange project..."
    remove_dirs
    remove_files
    log "INFO" "Cleanup complete."
}

# Function to display usage
usage() {
    echo -e "${BLUE}Usage: $0 <command>${NC}"
    echo ""
    echo "Commands:"
    echo "  all                   Perform a full cleanup (removes all build artifacts, logs, and dependencies)."
    echo "  dirs                  Remove only directories (e.g., venv, node_modules, logs)."
    echo "  files                 Remove only specific files (e.g., lock files, log files)."
    echo "  --help                Display this help message."
    echo ""
    echo "Example: $0 all"
}

# Main script logic
if [ $# -eq 0 ]; then
    usage
    exit 1
fi

COMMAND="$1"
shift

case "$COMMAND" in
    "all")
        clean_all
        ;;
    "dirs")
        remove_dirs
        ;;
    "files")
        remove_files
        ;;
    "--help"|"-h")
        usage
        ;;
    *)
        log "ERROR" "Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac

log "INFO" "Operation '$COMMAND' completed successfully."
