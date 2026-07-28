#!/bin/bash

# CarbonXchange Environment Manager
# A comprehensive script to set up, validate, and manage the development environment
#
# Features:
# - Unified environment validation and setup
# - Component-specific setup options
# - Dependency version checking
# - Cross-platform compatibility (Linux, macOS, Windows with WSL)

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

# Log file
LOG_FILE="$PROJECT_ROOT/cx_env_setup.log"
# Clear log file on start
: > "$LOG_FILE"

# Component directories
BACKEND_DIR="$PROJECT_ROOT/code/backend"
BLOCKCHAIN_DIR="$PROJECT_ROOT/code/blockchain"
WEB_FRONTEND_DIR="$PROJECT_ROOT/web-frontend"
MOBILE_FRONTEND_DIR="$PROJECT_ROOT/mobile-frontend"

# Required versions
REQUIRED_NODE_VERSION="18.0.0"
REQUIRED_PYTHON_VERSION="3.8.0"
REQUIRED_NPM_VERSION="8.0.0"
REQUIRED_YARN_VERSION="1.22.0"

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
    echo "[$level] $message" >> "$LOG_FILE"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Determine how to run privileged commands: real sudo, or nothing if we're
# already root. Falls back to running commands directly (with a warning) if
# neither applies, which is common in minimal containers.
if [ "$(id -u)" -eq 0 ]; then
    SUDO=""
elif command_exists sudo; then
    SUDO="sudo"
else
    SUDO=""
fi

# Function to compare versions
version_greater_equal() {
    # Returns 0 if $1 >= $2, 1 otherwise
    printf '%s\n%s\n' "$2" "$1" | sort -V -C
}

# Function to check system type
get_system_type() {
    case "$(uname -s)" in
        Linux*)     echo "Linux";;
        Darwin*)    echo "macOS";;
        CYGWIN*|MINGW*|MSYS*) echo "Windows";;
        *)          echo "Unknown";;
    esac
}

# Function to check if running in WSL
is_wsl() {
    if [ -f /proc/version ] && grep -q Microsoft /proc/version; then
        return 0
    fi
    return 1
}

# Function to install system dependencies based on OS
install_system_dependencies() {
    local system_type
    system_type=$(get_system_type)

    log "STEP" "Installing system dependencies for $system_type..."

    case "$system_type" in
        "Linux")
            if command_exists apt-get; then
                log "INFO" "Updating package lists..."
                $SUDO apt-get update -y

                log "INFO" "Installing essential packages (build-essential, curl, git, python3, python3-pip, python3-venv)..."
                # Using DEBIAN_FRONTEND=noninteractive for non-interactive installation
                $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y build-essential curl git python3 python3-pip python3-venv
            elif command_exists yum; then
                log "INFO" "Updating package lists..."
                $SUDO yum update -y

                log "INFO" "Installing essential packages..."
                $SUDO yum groupinstall -y "Development Tools"
                $SUDO yum install -y curl git python3 python3-pip
            else
                log "WARNING" "Unsupported Linux distribution. Please install dependencies manually."
            fi
            ;;
        "macOS")
            if ! command_exists brew; then
                log "INFO" "Installing Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi

            log "INFO" "Installing essential packages (git, python@3, node)..."
            brew install git python@3 node
            ;;
        "Windows")
            if is_wsl; then
                log "INFO" "Running in WSL, installing Linux dependencies..."
                $SUDO apt-get update -y
                $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y build-essential curl git python3 python3-pip python3-venv
            else
                log "WARNING" "Windows detected but not running in WSL. Please install dependencies manually."
            fi
            ;;
        *)
            log "WARNING" "Unsupported operating system. Please install dependencies manually."
            ;;
    esac
}

# Function to check and install Node.js
setup_node() {
    log "STEP" "Setting up Node.js environment..."

    if ! command_exists node; then
        log "INFO" "Node.js not found. Attempting to install Node.js $REQUIRED_NODE_VERSION..."

        local system_type
        system_type=$(get_system_type)
        # NodeSource setup scripts and Homebrew formulas are keyed by major
        # version only (e.g. "18"), not a full semver like "18.0.0".
        local node_major="${REQUIRED_NODE_VERSION%%.*}"
        case "$system_type" in
            "Linux")
                # Using nvm is generally safer, but for a simple setup script, we'll use the nodesource repo
                curl -fsSL https://deb.nodesource.com/setup_"$node_major".x | $SUDO -E bash -
                $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
                ;;
            "macOS")
                brew install node@"$node_major"
                ;;
            *)
                log "WARNING" "Please install Node.js manually for your system."
                return 1
                ;;
        esac
    fi

    if command_exists node; then
        local node_version
        node_version=$(node -v | cut -d 'v' -f 2)
        if ! version_greater_equal "$node_version" "$REQUIRED_NODE_VERSION"; then
            log "WARNING" "Node.js version $node_version is older than required version $REQUIRED_NODE_VERSION. Please update."
        else
            log "INFO" "Node.js version $node_version is installed and meets requirements."
        fi
    else
        log "ERROR" "Node.js installation failed."
        return 1
    fi

    # Check npm
    if command_exists npm; then
        local npm_version
        npm_version=$(npm -v)
        if ! version_greater_equal "$npm_version" "$REQUIRED_NPM_VERSION"; then
            log "WARNING" "npm version $npm_version is older than required version $REQUIRED_NPM_VERSION. Updating npm..."
            # Use npm to update itself globally, which is safer than using sudo if possible
            npm install -g npm@latest || $SUDO npm install -g npm@latest
        else
            log "INFO" "npm version $npm_version is installed and meets requirements."
        fi
    else
        log "ERROR" "npm not found. It should be installed with Node.js."
        return 1
    fi

    # Install Yarn if needed
    if ! command_exists yarn; then
        log "INFO" "Installing Yarn package manager globally..."
        npm install -g yarn || $SUDO npm install -g yarn
    else
        local yarn_version
        yarn_version=$(yarn -v)
        if ! version_greater_equal "$yarn_version" "$REQUIRED_YARN_VERSION"; then
            log "WARNING" "Yarn version $yarn_version is older than required version $REQUIRED_YARN_VERSION. Updating Yarn..."
            npm install -g yarn || $SUDO npm install -g yarn
        else
            log "INFO" "Yarn version $yarn_version is installed and meets requirements."
        fi
    fi

    # Install global npm packages for development tools
    # Note: expo-cli is intentionally excluded — it's deprecated and the
    # mobile app is run via the local "expo" package (npx expo / npm start).
    log "INFO" "Installing required global npm packages (truffle, ganache, eslint, prettier, solhint, mocha-junit-reporter)..."
    # Using npm install -g without sudo first, then with sudo as fallback
    npm install -g truffle ganache eslint prettier solhint mocha-junit-reporter || $SUDO npm install -g truffle ganache eslint prettier solhint mocha-junit-reporter

    return 0
}

# Function to check and install Python
setup_python() {
    log "STEP" "Setting up Python environment..."

    if command_exists python3; then
        local python_version
        python_version=$(python3 --version 2>&1 | awk '{print $2}')
        if ! version_greater_equal "$python_version" "$REQUIRED_PYTHON_VERSION"; then
            log "WARNING" "Python version $python_version is older than required version $REQUIRED_PYTHON_VERSION. Please update."
        else
            log "INFO" "Python version $python_version is installed and meets requirements."
        fi
    else
        log "ERROR" "Python 3 not found. Please install Python 3.8 or later."
        return 1
    fi

    # Check pip
    if ! command_exists pip3; then
        log "ERROR" "pip3 not found. Please install pip for Python 3."
        return 1
    fi

    # Create virtual environment if it doesn't exist
    local venv_path="$PROJECT_ROOT/venv"
    if [ ! -d "$venv_path" ]; then
        log "INFO" "Creating Python virtual environment at $venv_path..."
        python3 -m venv "$venv_path"
    fi

    # Install Python linting tools globally (or in user site-packages)
    log "INFO" "Installing Python linting tools (black, isort, flake8, pylint) in user site-packages..."
    pip3 install --user black isort flake8 pylint

    return 0
}

# Function to set up backend
setup_backend() {
    log "STEP" "Setting up backend environment..."

    if [ ! -d "$BACKEND_DIR" ]; then
        log "ERROR" "Backend directory not found at $BACKEND_DIR"
        return 1
    fi

    log "INFO" "Installing backend dependencies..."
    cd "$BACKEND_DIR"

    # Activate virtual environment
    local venv_activate="$PROJECT_ROOT/venv/bin/activate"
    if [ -f "$venv_activate" ]; then
        source "$venv_activate"
    else
        log "ERROR" "Virtual environment activation script not found at $venv_activate. Run setup_python first."
        return 1
    fi

    # Install requirements
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
    else
        log "WARNING" "requirements.txt not found in backend directory"
    fi

    # Deactivate virtual environment
    deactivate

    log "INFO" "Backend setup completed successfully"
    return 0
}

# Function to set up blockchain
setup_blockchain() {
    log "STEP" "Setting up blockchain environment..."

    if [ ! -d "$BLOCKCHAIN_DIR" ]; then
        log "ERROR" "Blockchain directory not found at $BLOCKCHAIN_DIR"
        return 1
    fi

    log "INFO" "Installing blockchain dependencies..."
    cd "$BLOCKCHAIN_DIR"

    # Install npm dependencies
    if [ -f "package.json" ]; then
        npm install
    else
        log "WARNING" "package.json not found in blockchain directory"
    fi

    log "INFO" "Blockchain setup completed successfully"
    return 0
}

# Function to set up web frontend
setup_web_frontend() {
    log "STEP" "Setting up web frontend environment..."

    if [ ! -d "$WEB_FRONTEND_DIR" ]; then
        log "ERROR" "Web frontend directory not found at $WEB_FRONTEND_DIR"
        return 1
    fi

    log "INFO" "Installing web frontend dependencies..."
    cd "$WEB_FRONTEND_DIR"

    # Install npm dependencies
    if [ -f "package.json" ]; then
        npm install
    else
        log "WARNING" "package.json not found in web frontend directory"
    fi

    log "INFO" "Web frontend setup completed successfully"
    return 0
}

# Function to set up mobile frontend
setup_mobile_frontend() {
    log "STEP" "Setting up mobile frontend environment..."

    if [ ! -d "$MOBILE_FRONTEND_DIR" ]; then
        log "ERROR" "Mobile frontend directory not found at $MOBILE_FRONTEND_DIR"
        return 1
    fi

    log "INFO" "Installing mobile frontend dependencies..."
    cd "$MOBILE_FRONTEND_DIR"

    # Install yarn dependencies
    if [ -f "package.json" ]; then
        yarn install
    else
        log "WARNING" "package.json not found in mobile frontend directory"
    fi

    log "INFO" "Mobile frontend setup completed successfully"
    return 0
}

# Function to run all setup steps
run_setup() {
    log "STEP" "Starting full environment setup..."

    install_system_dependencies
    setup_node
    setup_python
    setup_backend
    setup_blockchain
    setup_web_frontend
    setup_mobile_frontend

    log "INFO" "Full environment setup complete. Check $LOG_FILE for details."
}

# Function to display usage
usage() {
    echo -e "${BLUE}Usage: $0 <command> [component]${NC}"
    echo ""
    echo "Commands:"
    echo "  setup                 Run the full environment setup (system, node, python, components)."
    echo "  system                Install system-level dependencies."
    echo "  node                  Setup Node.js and global npm/yarn packages."
    echo "  python                Setup Python and virtual environment."
    echo "  backend               Install backend dependencies."
    echo "  blockchain            Install blockchain dependencies."
    echo "  web-frontend          Install web frontend dependencies."
    echo "  mobile-frontend       Install mobile frontend dependencies."
    echo "  --help                Display this help message."
    echo ""
    echo "Example: $0 setup"
    echo "Example: $0 backend"
}

# Main script logic
if [ $# -eq 0 ]; then
    usage
    exit 1
fi

COMMAND="$1"
shift

case "$COMMAND" in
    "setup")
        run_setup
        ;;
    "system")
        install_system_dependencies
        ;;
    "node")
        setup_node
        ;;
    "python")
        setup_python
        ;;
    "backend")
        setup_backend
        ;;
    "blockchain")
        setup_blockchain
        ;;
    "web-frontend")
        setup_web_frontend
        ;;
    "mobile-frontend")
        setup_mobile_frontend
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
