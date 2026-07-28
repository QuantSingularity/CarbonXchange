#!/bin/bash
# CarbonXchange Release Automation Script
# A utility script to automate the release process: versioning, building, and tagging.

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

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check for uncommitted changes
check_uncommitted_changes() {
    if ! command_exists git; then
        log "ERROR" "Git command not found. Cannot proceed with release."
        exit 1
    fi

    if [ -n "$(git status --porcelain)" ]; then
        log "ERROR" "Uncommitted changes detected. Please commit or stash them before creating a release."
        git status --short
        exit 1
    fi
    log "INFO" "No uncommitted changes found."
}

# Function to get the current version (delegates to cx_version.sh, which is
# the single source of truth for the project's VERSION file)
get_current_version() {
    "$SCRIPT_DIR/../tools/cx_version.sh" get
}

# Function to bump the version (delegates to cx_version.sh)
bump_version() {
    local type="$1"
    "$SCRIPT_DIR/../tools/cx_version.sh" bump "$type"
    "$SCRIPT_DIR/../tools/cx_version.sh" get
}

# Function to create a release
create_release() {
    local type="$1"
    local env="$2"

    log "STEP" "Starting $type release process for $env environment..."

    # 1. Check for uncommitted changes
    check_uncommitted_changes

    # 2. Bump version
    local new_version
    new_version=$(bump_version "$type")
    local tag_name="v$new_version"

    # 3. Run full build for the target environment
    log "STEP" "Running full build for $env environment..."
    local deploy_script="$SCRIPT_DIR/cx_deploy.sh"
    if [ ! -f "$deploy_script" ]; then
        log "ERROR" "Deployment script not found at $deploy_script."
        exit 1
    fi
    "$deploy_script" build "$env" || { log "ERROR" "Build failed for $env environment."; exit 1; }

    # 4. Commit version bump and build artifacts
    log "STEP" "Committing version bump and build artifacts..."
    git add "$PROJECT_ROOT/VERSION"
    # Add build artifacts if they are tracked (e.g., in a 'dist' folder)
    # git add dist/
    git commit -m "Release: $tag_name"

    # 5. Create git tag
    log "STEP" "Creating git tag: $tag_name"
    git tag -a "$tag_name" -m "Release $tag_name for $env"

    # 6. Push to remote (optional, but good practice)
    log "STEP" "Pushing commit and tag to remote (Placeholder)..."
    log "WARNING" "This step is a placeholder. Run 'git push && git push --tags' manually."

    log "INFO" "Release $tag_name created successfully. Ready for deployment to $env."
}

# Function to display usage
usage() {
    echo -e "${BLUE}Usage: $0 <type> <environment>${NC}"
    echo ""
    echo "Types:"
    echo "  patch                 For bug fixes and minor changes."
    echo "  minor                 For new features that are backward-compatible."
    echo "  major                 For breaking changes."
    echo ""
    echo "Environments: dev, staging, prod"
    echo "Example: $0 patch staging"
}

# Main script logic
if [ $# -ne 2 ]; then
    usage
    exit 1
fi

TYPE="$1"
ENV="$2"

create_release "$TYPE" "$ENV"

log "INFO" "Operation 'release $TYPE $ENV' completed successfully."
