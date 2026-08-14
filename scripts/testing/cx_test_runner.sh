#!/bin/bash
# CarbonXchange Test Automation Suite
# A comprehensive script to automate all testing processes
#
# Features:
# - Run unit tests for all components
# - Run integration tests
# - Run end-to-end tests
# - Generate test reports
# - Set up pre-commit hooks for testing

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
AI_MODELS_DIR="$PROJECT_ROOT/code/ai_models"

# Report directory
REPORT_DIR="$PROJECT_ROOT/test-reports"
mkdir -p "$REPORT_DIR"

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

# Function to run backend tests
run_backend_tests() {
    local test_type="$1"  # unit, integration, or all

    log "STEP" "Running backend $test_type tests..."

    if [ ! -d "$BACKEND_DIR" ]; then
        log "ERROR" "Backend directory not found at $BACKEND_DIR"
        return 1
    fi

    # Activate virtual environment in a subshell
    local exit_code=0
    (
        set +u # Allow unset variables in the subshell for source command
        source "$PROJECT_ROOT/venv/bin/activate"
        set -u

        local report_dir="$REPORT_DIR/backend"
        mkdir -p "$report_dir"

        # Backend tests live flat in tests/ and use a pytest marker (see
        # pytest.ini) to distinguish integration tests from everything else.
        local marker_args=()
        case "$test_type" in
            "unit") marker_args=(-m "not integration") ;;
            "integration") marker_args=(-m "integration") ;;
            "all") marker_args=() ;;
            *) log "ERROR" "Unknown test type: $test_type"; exit 1 ;;
        esac

        log "INFO" "Running backend $test_type tests with pytest..."
        cd "$BACKEND_DIR"
        # Run tests and generate JUnit XML report
        python -m pytest tests "${marker_args[@]}" --junitxml="$report_dir/$test_type-tests.xml" -v
    ) || exit_code=$?

    if [ "$exit_code" -eq 0 ]; then
        log "INFO" "Backend $test_type tests completed successfully"
    else
        log "ERROR" "Backend $test_type tests failed with exit code $exit_code"
        return "$exit_code"
    fi

    return 0
}

# Function to run blockchain tests
run_blockchain_tests() {
    log "STEP" "Running blockchain tests..."

    if [ ! -d "$BLOCKCHAIN_DIR" ]; then
        log "ERROR" "Blockchain directory not found at $BLOCKCHAIN_DIR"
        return 1
    fi

    local report_dir="$REPORT_DIR/blockchain"
    mkdir -p "$report_dir"

    log "INFO" "Running blockchain tests with Truffle..."
    local exit_code=0
    (
        cd "$BLOCKCHAIN_DIR"
        # This project uses Truffle (see truffle-config.js). `npx` will use
        # the local Truffle install from package.json if present, falling
        # back to a global install otherwise.
        npx truffle test --reporter mocha-junit-reporter --reporter-options mochaFile="$report_dir/blockchain-tests.xml"
    ) || exit_code=$?

    if [ "$exit_code" -eq 0 ]; then
        log "INFO" "Blockchain tests completed successfully"
    else
        log "ERROR" "Blockchain tests failed with exit code $exit_code"
        return "$exit_code"
    fi

    return 0
}

# Function to run web frontend tests
run_web_frontend_tests() {
    local test_type="$1"  # unit, integration, or all

    log "STEP" "Running web frontend $test_type tests..."

    if [ ! -d "$WEB_FRONTEND_DIR" ]; then
        log "ERROR" "Web frontend directory not found at $WEB_FRONTEND_DIR"
        return 1
    fi

    local report_dir="$REPORT_DIR/web-frontend"
    mkdir -p "$report_dir"

    if [ "$test_type" == "integration" ]; then
        log "WARNING" "web-frontend does not have a separate integration test suite yet. Skipping."
        return 0
    fi

    log "INFO" "Running web frontend tests with Vitest..."
    local exit_code=0
    (
        cd "$WEB_FRONTEND_DIR"
        # This is a Vitest project (not Jest) — use its real reporter flags
        # and the "test:run" script, which guarantees a single non-watch run.
        npm run test:run -- --reporter=json --outputFile="$report_dir/$test_type-tests.json"
    ) || exit_code=$?

    if [ "$exit_code" -eq 0 ]; then
        log "INFO" "Web frontend $test_type tests completed successfully"
    else
        log "ERROR" "Web frontend $test_type tests failed with exit code $exit_code"
        return "$exit_code"
    fi

    return 0
}

# Function to run mobile frontend tests
run_mobile_frontend_tests() {
    log "STEP" "Running mobile frontend tests..."

    if [ ! -d "$MOBILE_FRONTEND_DIR" ]; then
        log "ERROR" "Mobile frontend directory not found at $MOBILE_FRONTEND_DIR"
        return 1
    fi

    local report_dir="$REPORT_DIR/mobile-frontend"
    mkdir -p "$report_dir"

    log "INFO" "Running mobile frontend tests with yarn test..."
    local exit_code=0
    (
        cd "$MOBILE_FRONTEND_DIR"
        # Mobile frontend uses Jest (jest-expo), which supports these flags.
        yarn test --json --outputFile="$report_dir/mobile-tests.json"
    ) || exit_code=$?

    if [ "$exit_code" -eq 0 ]; then
        log "INFO" "Mobile frontend tests completed successfully"
    else
        log "ERROR" "Mobile frontend tests failed with exit code $exit_code"
        return "$exit_code"
    fi

    return 0
}

# Function to run AI model tests
run_ai_model_tests() {
    log "STEP" "Running AI model tests..."

    if [ ! -d "$AI_MODELS_DIR" ]; then
        log "ERROR" "AI models directory not found at $AI_MODELS_DIR"
        return 1
    fi

    if [ ! -d "$AI_MODELS_DIR/tests" ]; then
        log "WARNING" "No tests directory found in $AI_MODELS_DIR. Skipping AI model tests."
        return 0
    fi

    # Activate virtual environment in a subshell
    local exit_code=0
    (
        set +u # Allow unset variables in the subshell for source command
        source "$PROJECT_ROOT/venv/bin/activate"
        set -u

        local report_dir="$REPORT_DIR/ai-models"
        mkdir -p "$report_dir"

        log "INFO" "Running AI model tests with pytest..."
        cd "$AI_MODELS_DIR"
        python -m pytest tests --junitxml="$report_dir/ai-model-tests.xml" -v
    ) || exit_code=$?

    if [ "$exit_code" -eq 0 ]; then
        log "INFO" "AI model tests completed successfully"
    else
        log "ERROR" "AI model tests failed with exit code $exit_code"
        return "$exit_code"
    fi

    return 0
}

# Function to run end-to-end tests
run_e2e_tests() {
    log "STEP" "Running end-to-end tests..."

    local report_dir="$REPORT_DIR/e2e"
    mkdir -p "$report_dir"

    if ! command_exists npx; then
        log "ERROR" "npx not found. Cannot run Cypress."
        return 1
    fi

    if ! find "$PROJECT_ROOT" -maxdepth 2 \( -name "cypress.config.js" -o -name "cypress.config.ts" \) -print -quit | grep -q .; then
        log "WARNING" "No Cypress config found in the project. Skipping end-to-end tests."
        return 0
    fi

    log "INFO" "Running end-to-end tests with Cypress..."
    local exit_code=0
    (
        cd "$PROJECT_ROOT"
        # Cypress requires the application services to be running.
        # The user should ensure services are started before running E2E tests.
        log "WARNING" "Ensure all application services are running before running E2E tests."
        npx cypress run --reporter junit --reporter-options "mochaFile=$report_dir/e2e-tests.xml"
    ) || exit_code=$?

    if [ "$exit_code" -eq 0 ]; then
        log "INFO" "End-to-end tests completed successfully"
    else
        log "ERROR" "End-to-end tests failed with exit code $exit_code"
        return "$exit_code"
    fi

    return 0
}

# Function to generate test coverage report
generate_coverage_report() {
    log "STEP" "Generating test coverage reports..."

    local coverage_dir="$REPORT_DIR/coverage"
    mkdir -p "$coverage_dir"

    # Backend coverage
    if [ -d "$BACKEND_DIR" ]; then
        log "INFO" "Generating backend coverage report..."
        (
            set +u
            source "$PROJECT_ROOT/venv/bin/activate"
            set -u
            cd "$BACKEND_DIR"
            # Assuming pytest-cov is installed
            python -m pytest --cov=. --cov-report=html:"$coverage_dir/backend-html" --cov-report=xml:"$coverage_dir/backend-coverage.xml" tests/
        ) || log "WARNING" "Backend coverage generation failed."
    fi

    # Web frontend coverage
    if [ -d "$WEB_FRONTEND_DIR" ]; then
        log "INFO" "Generating web frontend coverage report..."
        (
            cd "$WEB_FRONTEND_DIR"
            # This is a Vitest project — coverage directory is a nested
            # option flag, not Jest's --coverageDirectory.
            npm run test:coverage -- --coverage.reportsDirectory="$coverage_dir/web-frontend"
        ) || log "WARNING" "Web frontend coverage generation failed."
    fi

    # Mobile frontend coverage
    if [ -d "$MOBILE_FRONTEND_DIR" ]; then
        log "INFO" "Generating mobile frontend coverage report..."
        (
            cd "$MOBILE_FRONTEND_DIR"
            # Assuming Jest/Expo coverage is configured
            yarn test --coverage --coverageDirectory="$coverage_dir/mobile-frontend"
        ) || log "WARNING" "Mobile frontend coverage generation failed."
    fi

    log "INFO" "Coverage reports generated in $coverage_dir"
}

# Function to set up pre-commit hooks
setup_pre_commit_hooks() {
    log "STEP" "Setting up pre-commit hooks..."

    if [ ! -d "$PROJECT_ROOT/.git" ]; then
        log "ERROR" "Git repository not found at $PROJECT_ROOT"
        return 1
    fi

    local hooks_dir="$PROJECT_ROOT/.git/hooks"
    mkdir -p "$hooks_dir"

    log "INFO" "Creating pre-commit hook..."
    cat > "$hooks_dir/pre-commit" << EOF
#!/bin/bash

# CarbonXchange pre-commit hook
# This hook runs linting and unit tests before allowing a commit

set -euo pipefail

# Get the project root directory
PROJECT_ROOT=\$(git rev-parse --show-toplevel)

# Path to the linting script
LINT_SCRIPT="\$PROJECT_ROOT/scripts/tools/cx_lint_all.sh"

# Path to the test runner script
TEST_SCRIPT="\$PROJECT_ROOT/scripts/testing/cx_test_runner.sh"

# Run linting
echo "Running linting..."
if ! "\$LINT_SCRIPT"; then
    echo "Linting failed. Please fix the issues before committing."
    exit 1
fi

# Run unit tests
echo "Running unit tests..."
if ! "\$TEST_SCRIPT" unit; then
    echo "Unit tests failed. Please fix the issues before committing."
    exit 1
fi

echo "Pre-commit checks passed."
exit 0
EOF

    chmod +x "$hooks_dir/pre-commit"
    log "INFO" "Pre-commit hook created and made executable."
}

# Function to display usage
usage() {
    echo -e "${BLUE}Usage: $0 <command> [component]${NC}"
    echo ""
    echo "Commands:"
    echo "  unit                  Run unit tests for all components."
    echo "  integration           Run integration tests for all components."
    echo "  e2e                   Run end-to-end tests (requires services to be running)."
    echo "  all                   Run all tests (unit, integration, e2e)."
    echo "  coverage              Generate test coverage reports."
    echo "  hooks                 Setup git pre-commit hooks."
    echo "  --help                Display this help message."
    echo ""
    echo "Components (for unit/integration): backend, blockchain, web-frontend, mobile-frontend, ai-models"
    echo "Example: $0 unit backend"
    echo "Example: $0 all"
}

# Main script logic
if [ $# -eq 0 ]; then
    usage
    exit 1
fi

COMMAND="$1"
COMPONENT="${2:-}"

# Tracks whether anything failed, so one failing suite doesn't prevent the
# rest from running and the final exit code reflects the real outcome.
OVERALL_EXIT=0

case "$COMMAND" in
    "unit")
        if [ -z "$COMPONENT" ] || [ "$COMPONENT" == "backend" ]; then run_backend_tests "unit" || OVERALL_EXIT=1; fi
        if [ -z "$COMPONENT" ] || [ "$COMPONENT" == "blockchain" ]; then run_blockchain_tests || OVERALL_EXIT=1; fi
        if [ -z "$COMPONENT" ] || [ "$COMPONENT" == "web-frontend" ]; then run_web_frontend_tests "unit" || OVERALL_EXIT=1; fi
        if [ -z "$COMPONENT" ] || [ "$COMPONENT" == "mobile-frontend" ]; then run_mobile_frontend_tests || OVERALL_EXIT=1; fi
        if [ -z "$COMPONENT" ] || [ "$COMPONENT" == "ai-models" ]; then run_ai_model_tests || OVERALL_EXIT=1; fi
        ;;
    "integration")
        if [ -z "$COMPONENT" ] || [ "$COMPONENT" == "backend" ]; then run_backend_tests "integration" || OVERALL_EXIT=1; fi
        if [ -z "$COMPONENT" ] || [ "$COMPONENT" == "web-frontend" ]; then run_web_frontend_tests "integration" || OVERALL_EXIT=1; fi
        log "WARNING" "Integration tests for other components are not yet implemented."
        ;;
    "e2e")
        run_e2e_tests || OVERALL_EXIT=1
        ;;
    "all")
        run_backend_tests "all" || OVERALL_EXIT=1
        run_blockchain_tests || OVERALL_EXIT=1
        run_web_frontend_tests "all" || OVERALL_EXIT=1
        run_mobile_frontend_tests || OVERALL_EXIT=1
        run_ai_model_tests || OVERALL_EXIT=1
        run_e2e_tests || OVERALL_EXIT=1
        ;;
    "coverage")
        generate_coverage_report || OVERALL_EXIT=1
        ;;
    "hooks")
        setup_pre_commit_hooks || OVERALL_EXIT=1
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

if [ "$OVERALL_EXIT" -eq 0 ]; then
    log "INFO" "Operation '$COMMAND' completed successfully."
else
    log "ERROR" "Operation '$COMMAND' completed with failures. Review the output above."
fi
exit "$OVERALL_EXIT"
