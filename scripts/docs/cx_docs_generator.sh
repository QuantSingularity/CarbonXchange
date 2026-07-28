#!/bin/bash
# CarbonXchange Documentation Generator
# A script to automate documentation generation and validation
#
# Features:
# - API documentation generation
# - Project status reporting
# - Changelog generation
# - Documentation validation

set -euo pipefail # Exit on error, treat unset variables as error, and fail if any command in a pipeline fails

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

# Component directories
BACKEND_DIR="$PROJECT_ROOT/code/backend"
BLOCKCHAIN_DIR="$PROJECT_ROOT/code/blockchain"
WEB_FRONTEND_DIR="$PROJECT_ROOT/web-frontend"
MOBILE_FRONTEND_DIR="$PROJECT_ROOT/mobile-frontend"

# Output directory for generated documentation
OUTPUT_DIR="$PROJECT_ROOT/generated-docs"
mkdir -p "$OUTPUT_DIR"

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

# Function to generate API documentation
generate_api_docs() {
    log "STEP" "Generating API documentation..."

    if [ ! -d "$BACKEND_DIR" ]; then
        log "ERROR" "Backend directory not found at $BACKEND_DIR"
        return 1
    fi

    # Create output directory
    local api_docs_dir="$OUTPUT_DIR/api"
    mkdir -p "$api_docs_dir"

    # Check if backend uses Python
    if [ -f "$BACKEND_DIR/requirements.txt" ]; then
        # Activate virtual environment
        local venv_activate="$PROJECT_ROOT/venv/bin/activate"
        if [ -f "$venv_activate" ]; then
            source "$venv_activate"
            log "INFO" "Activated Python virtual environment."
        else
            log "WARNING" "Python virtual environment not found. Skipping docstring generation."
        fi

        # Generate API documentation from docstrings using pdoc3
        if command_exists pdoc3; then
            log "INFO" "Generating API documentation from docstrings using pdoc3..."
            # Target src/ specifically — it's the actual importable package
            # (has __init__.py); the backend root also contains venv,
            # instance, logs, uploads, and static, which aren't Python source.
            pdoc3 --html --output-dir "$api_docs_dir/docstrings" "$BACKEND_DIR/src" || log "WARNING" "pdoc3 failed to generate documentation."
            log "INFO" "API documentation from docstrings generated at $api_docs_dir/docstrings"
        else
            log "WARNING" "pdoc3 not found. Skipping docstring generation. Install with 'pip install pdoc3'."
        fi

        # Deactivate virtual environment
        if [ -f "$venv_activate" ]; then
            deactivate
        fi
    fi

    # OpenAPI/Swagger generation logic (simplified, as the original was complex and prone to failure)
    log "INFO" "Checking for OpenAPI specification..."
    if [ -f "$BACKEND_DIR/openapi.yaml" ]; then
        cp "$BACKEND_DIR/openapi.yaml" "$api_docs_dir/"
        log "INFO" "OpenAPI specification (YAML) copied to $api_docs_dir"
    elif [ -f "$BACKEND_DIR/openapi.json" ]; then
        cp "$BACKEND_DIR/openapi.json" "$api_docs_dir/"
        log "INFO" "OpenAPI specification (JSON) copied to $api_docs_dir"
    else
        log "WARNING" "No pre-generated OpenAPI specification found. Skipping Swagger UI generation."
    fi

    log "INFO" "API documentation generation completed"
    return 0
}

# Function to generate project status report
generate_status_report() {
    log "STEP" "Generating project status report..."

    # Create output directory
    local status_dir="$OUTPUT_DIR/status"
    mkdir -p "$status_dir"

    # Create status report file
    local report_file="$status_dir/project_status.md"

    # Write report header
    cat > "$report_file" << EOF
# CarbonXchange Project Status Report

Generated on: $(date)

## Project Overview

CarbonXchange is a blockchain-based carbon credit trading platform that leverages blockchain technology and artificial intelligence to revolutionize carbon credit trading, making it more transparent, efficient, and accessible for businesses and individuals.

## Component Status

EOF

    # Check backend status
    if [ -d "$BACKEND_DIR" ]; then
        echo "### Backend" >> "$report_file"
        echo "" >> "$report_file"

        # Count Python files
        local py_files
        py_files=$(find "$BACKEND_DIR" -name "*.py" | wc -l)
        echo "- Python files: $py_files" >> "$report_file"

        # Check test coverage if pytest is available
        if command_exists pytest; then
            log "INFO" "Running backend tests for coverage report..."
            local venv_activate="$PROJECT_ROOT/venv/bin/activate"
            if [ -f "$venv_activate" ]; then
                source "$venv_activate"
                # Run pytest with coverage, suppressing output to a temp file
                if python -m pytest --cov="$BACKEND_DIR/src" --cov-report=xml:"$status_dir/backend_coverage.xml" "$BACKEND_DIR/tests" > /dev/null 2>&1; then
                    # Parse the standard Cobertura XML line-rate attribute
                    # (coverage.py's XML output), rather than trying to grep
                    # a terminal-style "TOTAL ... %" line out of an XML file.
                    local coverage="N/A"
                    local line_rate
                    line_rate=$(grep -oE 'line-rate="[0-9.]+"' "$status_dir/backend_coverage.xml" | head -n 1 | grep -oE '[0-9.]+')
                    if [ -n "$line_rate" ]; then
                        coverage=$(awk -v r="$line_rate" 'BEGIN { printf "%.0f%%", r * 100 }')
                    fi
                    echo "  - Overall coverage: ${coverage}" >> "$report_file"
                else
                    log "WARNING" "Backend test coverage failed to run."
                    echo "  - Overall coverage: N/A (Tests failed or coverage tool not found)" >> "$report_file"
                fi
                deactivate
            else
                log "WARNING" "Python virtual environment not found. Skipping backend coverage."
            fi
        fi

        echo "" >> "$report_file"
    fi

    # Check web frontend status
    if [ -d "$WEB_FRONTEND_DIR" ]; then
        echo "### Web Frontend" >> "$report_file"
        echo "" >> "$report_file"

        # Count JS/TS files
        local js_files
        js_files=$(find "$WEB_FRONTEND_DIR" -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" | wc -l)
        echo "- JavaScript/TypeScript files: $js_files" >> "$report_file"

        # Check test coverage if npm is available
        if command_exists npm; then
            log "INFO" "Running web frontend tests for coverage report..."
            # This is a Vitest project — use its real reporter flags via the
            # project's own test:coverage script.
            if (cd "$WEB_FRONTEND_DIR" && npm run test:coverage -- --coverage.reporter=json-summary > /dev/null 2>&1); then
                local coverage_file="$WEB_FRONTEND_DIR/coverage/coverage-summary.json"
                if [ -f "$coverage_file" ]; then
                    local statements
                    statements=$(grep -oE '"statements"\s*:\s*\{[^}]*\}' "$coverage_file" | grep -oE '"pct"\s*:\s*[0-9.]+' | grep -oE '[0-9.]+$')
                    echo "  - Overall coverage: ${statements:-N/A}%" >> "$report_file"
                else
                    log "WARNING" "Web frontend coverage summary not found."
                    echo "  - Overall coverage: N/A (Coverage summary file missing)" >> "$report_file"
                fi
            else
                log "WARNING" "Web frontend test coverage failed to run."
                echo "  - Overall coverage: N/A (Tests failed or coverage tool not found)" >> "$report_file"
            fi
        fi

        echo "" >> "$report_file"
    fi

    # Check mobile frontend status
    if [ -d "$MOBILE_FRONTEND_DIR" ]; then
        echo "### Mobile Frontend" >> "$report_file"
        echo "" >> "$report_file"

        # Count JS/TS files
        local mobile_files
        mobile_files=$(find "$MOBILE_FRONTEND_DIR" -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" | wc -l)
        echo "- JavaScript/TypeScript files: $mobile_files" >> "$report_file"

        # Test coverage (similar logic as web frontend, assuming yarn test)
        if command_exists yarn; then
            log "INFO" "Running mobile frontend tests for coverage report..."
            if (cd "$MOBILE_FRONTEND_DIR" && yarn test --coverage --coverageReporters="json-summary" > /dev/null 2>&1); then
                local coverage_file="$MOBILE_FRONTEND_DIR/coverage/coverage-summary.json"
                if [ -f "$coverage_file" ]; then
                    local statements
                    statements=$(grep -oE '"statements"\s*:\s*\{[^}]*\}' "$coverage_file" | grep -oE '"pct"\s*:\s*[0-9.]+' | grep -oE '[0-9.]+$')
                    echo "  - Overall coverage: ${statements:-N/A}%" >> "$report_file"
                else
                    log "WARNING" "Mobile frontend coverage summary not found."
                    echo "  - Overall coverage: N/A (Coverage summary file missing)" >> "$report_file"
                fi
            else
                log "WARNING" "Mobile frontend test coverage failed to run."
                echo "  - Overall coverage: N/A (Tests failed or coverage tool not found)" >> "$report_file"
            fi
        fi

        echo "" >> "$report_file"
    fi

    # Check blockchain status
    if [ -d "$BLOCKCHAIN_DIR" ]; then
        echo "### Blockchain" >> "$report_file"
        echo "" >> "$report_file"

        # Count Solidity files
        local sol_files
        sol_files=$(find "$BLOCKCHAIN_DIR" -name "*.sol" | wc -l)
        echo "- Solidity files: $sol_files" >> "$report_file"

        # Check for Truffle/Hardhat config
        if [ -f "$BLOCKCHAIN_DIR/truffle-config.js" ] || [ -f "$BLOCKCHAIN_DIR/hardhat.config.js" ]; then
            echo "- Build System: Truffle/Hardhat" >> "$report_file"
        fi

        echo "" >> "$report_file"
    fi

    log "INFO" "Project status report generated at $report_file"
    return 0
}

# Function to generate changelog
generate_changelog() {
    log "STEP" "Generating changelog from git history..."

    # Create output directory
    local changelog_dir="$OUTPUT_DIR/changelog"
    mkdir -p "$changelog_dir"

    # Create changelog file
    local changelog_file="$changelog_dir/CHANGELOG.md"

    # Use git log to generate a basic changelog
    log "INFO" "Using git log to generate basic changelog..."
    {
        echo "# Changelog"
        echo ""
        git log --pretty=format:"* %h - %an, %ad: %s" --date=short
    } > "$changelog_file"

    log "INFO" "Changelog generated at $changelog_file"
    return 0
}

# Function to validate documentation links (Placeholder)
validate_docs() {
    log "STEP" "Validating documentation links (Placeholder)..."
    log "WARNING" "Documentation validation is a placeholder. Consider using a tool like 'markdown-link-check' or 'lychee'."
    return 0
}

# Function to display usage
usage() {
    echo -e "${BLUE}Usage: $0 <command>${NC}"
    echo ""
    echo "Commands:"
    echo "  api                   Generate API documentation (docstrings and OpenAPI spec)."
    echo "  status                Generate a project status report (file counts, test coverage)."
    echo "  changelog             Generate a basic changelog from git history."
    echo "  validate              Validate documentation links and structure (Placeholder)."
    echo "  all                   Run all documentation generation commands."
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
    "api")
        generate_api_docs
        ;;
    "status")
        generate_status_report
        ;;
    "changelog")
        generate_changelog
        ;;
    "validate")
        validate_docs
        ;;
    "all")
        generate_api_docs && \
        generate_status_report && \
        generate_changelog && \
        validate_docs
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
