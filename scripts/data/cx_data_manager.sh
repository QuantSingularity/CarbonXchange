#!/bin/bash
# CarbonXchange Data Manager Script
# A utility script to manage data-related tasks: download, validate, and process.

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

# Data directory
DATA_DIR="$PROJECT_ROOT/resources/datasets"
mkdir -p "$DATA_DIR"

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

# Function to download data
download_data() {
    log "STEP" "Downloading required datasets..."

    # Example dataset: carbon_credit_data.csv
    local carbon_data_url="https://example.com/data/carbon_credit_data.csv" # Placeholder URL
    local carbon_data_file="$DATA_DIR/carbon_credit_data.csv"

    if [ ! -f "$carbon_data_file" ]; then
        log "INFO" "Downloading carbon credit data from $carbon_data_url..."
        if command_exists curl; then
            curl -s -o "$carbon_data_file" "$carbon_data_url" || log "WARNING" "Failed to download carbon credit data. Using existing or placeholder file."
        elif command_exists wget; then
            wget -q -O "$carbon_data_file" "$carbon_data_url" || log "WARNING" "Failed to download carbon credit data. Using existing or placeholder file."
        else
            log "ERROR" "Neither curl nor wget found. Cannot download data."
            return 1
        fi
    else
        log "INFO" "Carbon credit data already exists. Skipping download."
    fi

    # Example dataset: market_demand.csv
    local market_data_url="https://example.com/data/market_demand.csv" # Placeholder URL
    local market_data_file="$DATA_DIR/market_demand.csv"

    if [ ! -f "$market_data_file" ]; then
        log "INFO" "Downloading market demand data from $market_data_url..."
        if command_exists curl; then
            curl -s -o "$market_data_file" "$market_data_url" || log "WARNING" "Failed to download market demand data. Using existing or placeholder file."
        elif command_exists wget; then
            wget -q -O "$market_data_file" "$market_data_url" || log "WARNING" "Failed to download market demand data. Using existing or placeholder file."
        fi
    else
        log "INFO" "Market demand data already exists. Skipping download."
    fi

    log "INFO" "Data download process completed."
}

# Function to validate data (Placeholder)
validate_data() {
    log "STEP" "Validating datasets (Placeholder)..."
    log "WARNING" "Data validation is a placeholder. Implement checks for integrity, format, and completeness."

    # Example: Check if CSV files are non-empty
    local all_valid=true
    for file in "$DATA_DIR"/*.csv; do
        if [ -f "$file" ]; then
            if [ ! -s "$file" ]; then
                log "ERROR" "Data file is empty: $(basename "$file")"
                all_valid=false
            fi
        fi
    done

    if $all_valid; then
        log "INFO" "Basic data validation passed."
    else
        log "ERROR" "Data validation failed."
        return 1
    fi
}

# Function to process data (Placeholder)
process_data() {
    log "STEP" "Processing datasets (Placeholder)..."
    log "WARNING" "Data processing is a placeholder. Implement scripts for cleaning, feature engineering, and transformation."

    # Example: Run a Python script for processing
    local processing_script="$PROJECT_ROOT/code/ai_models/training_scripts/data_preprocessing.py"
    if [ -f "$processing_script" ]; then
        log "INFO" "Running Python data processing script..."
        # Note: data_preprocessing.py currently only defines a
        # preprocess_data(filepath) function with no CLI entry point, so
        # running it directly is a no-op until it gains a __main__ block.
        (
            set +u
            source "$PROJECT_ROOT/venv/bin/activate"
            set -u
            python "$processing_script"
        ) || { log "ERROR" "Data processing script failed."; return 1; }
    else
        log "WARNING" "Data processing script not found at $processing_script. Skipping."
    fi

    log "INFO" "Data processing completed."
}

# Function to display usage
usage() {
    echo -e "${BLUE}Usage: $0 <command>${NC}"
    echo ""
    echo "Commands:"
    echo "  download              Download all required datasets."
    echo "  validate              Validate the integrity and format of the datasets."
    echo "  process               Run data processing and transformation scripts."
    echo "  all                   Run download, validate, and process sequentially."
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
    "download")
        download_data
        ;;
    "validate")
        validate_data
        ;;
    "process")
        process_data
        ;;
    "all")
        download_data && validate_data && process_data
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
