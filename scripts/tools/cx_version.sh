#!/bin/bash
# CarbonXchange Version Management Script
# A utility script to get, set, or bump the project version.

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

# Function to get the current version from the root VERSION file
get_current_version() {
    local version_file="$PROJECT_ROOT/VERSION"
    if [ -f "$version_file" ]; then
        tr -d '[:space:]' < "$version_file"
    else
        log "WARNING" "VERSION file not found at $version_file. Assuming version 0.0.0."
        echo "0.0.0"
    fi
}

# Function to set the version in the root VERSION file
set_version() {
    local new_version="$1"
    local version_file="$PROJECT_ROOT/VERSION"
    local current_version
    current_version=$(get_current_version)

    echo "$new_version" > "$version_file"
    log "INFO" "Version updated from $current_version to $new_version in VERSION."
}

# Function to bump the version
bump_version() {
    local type="$1"
    local current_version
    current_version=$(get_current_version)
    local major minor patch
    IFS='.' read -r major minor patch <<< "$current_version"

    case "$type" in
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "patch")
            patch=$((patch + 1))
            ;;
        *)
            log "ERROR" "Invalid version bump type: $type. Must be major, minor, or patch."
            return 1
            ;;
    esac

    local new_version="$major.$minor.$patch"
    log "INFO" "Bumping version from $current_version to $new_version ($type bump)."
    set_version "$new_version"
}

# Function to display usage
usage() {
    echo -e "${BLUE}Usage: $0 <command> [type|version]${NC}"
    echo ""
    echo "Commands:"
    echo "  get                   Display the current project version."
    echo "  set <version>         Set the project version to a specific value (e.g., 1.2.3)."
    echo "  bump <type>           Increment the version (type: major, minor, patch)."
    echo "  --help                Display this help message."
    echo ""
    echo "Example: $0 get"
    echo "Example: $0 bump minor"
}

# Main script logic
if [ $# -eq 0 ]; then
    usage
    exit 1
fi

COMMAND="$1"
shift

case "$COMMAND" in
    "get")
        get_current_version
        ;;
    "set")
        if [ $# -ne 1 ]; then
            log "ERROR" "Set command requires a version number."
            usage
            exit 1
        fi
        set_version "$1"
        ;;
    "bump")
        if [ $# -ne 1 ]; then
            log "ERROR" "Bump command requires a type (major, minor, patch)."
            usage
            exit 1
        fi
        bump_version "$1"
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
