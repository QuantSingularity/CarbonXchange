#!/bin/bash
# CarbonXchange Deployment Pipeline Enhancer
# A script to automate deployment processes for different environments
#
# Features:
# - Environment-specific deployment (dev, staging, production)
# - Configuration management
# - Deployment validation
# - Rollback automation

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
INFRA_DIR="$PROJECT_ROOT/infrastructure"

# Deployment directories
DEPLOY_DIR="$PROJECT_ROOT/deploy"
# Backup directory for rollbacks
BACKUP_DIR="$PROJECT_ROOT/deploy/backups"

# Environment configuration templates
ENV_TEMPLATES_DIR="$INFRA_DIR/env-templates"

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

# Function to validate environment name
validate_environment() {
    local env="$1"
    case "$env" in
        "dev"|"development")
            echo "dev"
            ;;
        "staging"|"test")
            echo "staging"
            ;;
        "prod"|"production")
            echo "prod"
            ;;
        *)
            log "ERROR" "Invalid environment: $env. Must be one of: dev, staging, prod"
            exit 1
            ;;
    esac
}

# Function to generate environment-specific configuration
generate_config() {
    local env="$1"

    log "STEP" "Generating configuration for $env environment..."

    # Create environment-specific config directory
    local config_dir="$DEPLOY_DIR/$env/config"
    mkdir -p "$config_dir"

    if [ ! -d "$ENV_TEMPLATES_DIR" ]; then
        log "WARNING" "Environment templates directory not found at $ENV_TEMPLATES_DIR. Skipping template generation (nothing to process)."
    else
        # Check for envsubst
        if ! command_exists envsubst; then
            log "ERROR" "envsubst command not found. Please install gettext package."
            return 1
        fi

        # Process each template file
        find "$ENV_TEMPLATES_DIR" -type f -name "*.template" | while read -r template; do
            local filename
            filename=$(basename "$template" .template)
            log "INFO" "Processing template: $filename"

            # Replace environment variables in template
            envsubst < "$template" > "$config_dir/$filename"
            log "INFO" "Generated $filename for $env environment"
        done
    fi

    # Generate .env file for backend
    local env_file="$ENV_TEMPLATES_DIR/.env.$env"
    if [ -f "$env_file" ]; then
        log "INFO" "Copying .env file for backend..."
        cp "$env_file" "$config_dir/.env"
    else
        log "WARNING" ".env.$env file not found in templates directory. Skipping."
    fi

    log "INFO" "Configuration generation completed for $env environment"
    return 0
}

# Function to build backend for deployment
build_backend() {
    local env="$1"

    log "STEP" "Building backend for $env environment..."

    if [ ! -d "$BACKEND_DIR" ]; then
        log "ERROR" "Backend directory not found at $BACKEND_DIR"
        return 1
    fi

    # Create deployment directory
    local deploy_backend_dir="$DEPLOY_DIR/$env/backend"
    mkdir -p "$deploy_backend_dir"

    # Copy backend code using safer rsync
    log "INFO" "Copying backend code..."
    rsync -av --delete --exclude='__pycache__/' --exclude='*.pyc' --exclude='.pytest_cache/' \
        --exclude='venv/' --exclude='node_modules/' "$BACKEND_DIR/" "$deploy_backend_dir/"

    # Copy environment-specific configuration
    local config_env_file="$DEPLOY_DIR/$env/config/.env"
    if [ -f "$config_env_file" ]; then
        log "INFO" "Copying environment configuration..."
        cp "$config_env_file" "$deploy_backend_dir/"
    else
        log "WARNING" "Backend .env file not found in config directory. Deployment may fail."
    fi

    # Install dependencies in a virtual environment
    log "INFO" "Setting up virtual environment..."
    local venv_path="$deploy_backend_dir/venv"
    python3 -m venv "$venv_path"
    # Activate and install
    # Using a subshell for activation to avoid polluting the main script's environment
    (
        set +u # Allow unset variables in the subshell for source command
        source "$venv_path/bin/activate"
        set -u
        log "INFO" "Installing Python dependencies..."
        pip install -r "$deploy_backend_dir/requirements.txt"
        # Run database migrations if needed (requires a proper setup, here just a placeholder)
        # if [ -f "$deploy_backend_dir/manage.py" ]; then
        #     log "INFO" "Running database migrations..."
        #     python "$deploy_backend_dir/manage.py" migrate
        # fi
    ) || { log "ERROR" "Backend dependency installation or migration failed."; return 1; }

    log "INFO" "Backend build completed for $env environment"
    return 0
}

# Function to build web frontend for deployment
build_web_frontend() {
    local env="$1"

    log "STEP" "Building web frontend for $env environment..."

    if [ ! -d "$WEB_FRONTEND_DIR" ]; then
        log "ERROR" "Web frontend directory not found at $WEB_FRONTEND_DIR"
        return 1
    fi

    # Create deployment directory
    local deploy_frontend_dir="$DEPLOY_DIR/$env/web-frontend"
    mkdir -p "$deploy_frontend_dir"

    # Copy frontend code
    log "INFO" "Copying web frontend code..."
    rsync -av --delete --exclude='node_modules/' --exclude='dist/' --exclude='build/' \
        --exclude='.cache/' "$WEB_FRONTEND_DIR/" "$deploy_frontend_dir/"

    # Copy environment-specific configuration
    local config_env_file="$DEPLOY_DIR/$env/config/frontend.env.js"
    if [ -f "$config_env_file" ]; then
        log "INFO" "Setting up environment configuration..."
        cp "$config_env_file" "$deploy_frontend_dir/.env"
    else
        log "WARNING" "Frontend config file not found. Using default."
    fi

    # Install dependencies and build
    log "INFO" "Installing dependencies and building web frontend..."
    (
        cd "$deploy_frontend_dir"
        npm install
        npm run build
    ) || { log "ERROR" "Web frontend build failed."; return 1; }

    log "INFO" "Web frontend build completed for $env environment"
    return 0
}

# Function to build blockchain contracts for deployment
build_blockchain() {
    local env="$1"

    log "STEP" "Building blockchain contracts for $env environment..."

    if [ ! -d "$BLOCKCHAIN_DIR" ]; then
        log "ERROR" "Blockchain directory not found at $BLOCKCHAIN_DIR"
        return 1
    fi

    # Create deployment directory
    local deploy_blockchain_dir="$DEPLOY_DIR/$env/blockchain"
    mkdir -p "$deploy_blockchain_dir"

    # Copy blockchain code
    log "INFO" "Copying blockchain code..."
    rsync -av --delete --exclude='node_modules/' --exclude='build/' \
        "$BLOCKCHAIN_DIR/" "$deploy_blockchain_dir/"

    # Copy environment-specific configuration
    local config_truffle_file="$DEPLOY_DIR/$env/config/truffle-config.js"
    if [ -f "$config_truffle_file" ]; then
        log "INFO" "Setting up environment configuration..."
        cp "$config_truffle_file" "$deploy_blockchain_dir/truffle-config.js"
    else
        log "WARNING" "Truffle config file not found. Using default."
    fi

    # Install dependencies and compile contracts
    log "INFO" "Installing dependencies and compiling contracts..."
    (
        cd "$deploy_blockchain_dir"
        npm install
        npx truffle compile
    ) || { log "ERROR" "Blockchain build failed."; return 1; }

    log "INFO" "Blockchain contracts build completed for $env environment"
    return 0
}

# Function to create a backup of the current deployment
create_backup() {
    local env="$1"
    local timestamp
    timestamp=$(date +%Y%m%d%H%M%S)
    local backup_name="$env-$timestamp"

    log "STEP" "Creating backup for $env deployment: $backup_name"
    mkdir -p "$BACKUP_DIR"

    # Check if a previous deployment exists
    if [ -d "$DEPLOY_DIR/$env/current" ]; then
        # Archive the current deployment
        tar -czf "$BACKUP_DIR/$backup_name.tar.gz" -C "$DEPLOY_DIR/$env" current
        log "INFO" "Backup created at $BACKUP_DIR/$backup_name.tar.gz"
    else
        log "WARNING" "No previous deployment found for $env. Skipping backup."
    fi
}

# Function to deploy to environment
deploy_to_environment() {
    local env="$1"

    log "STEP" "Deploying to $env environment..."

    # Validate that builds exist
    local build_dir="$DEPLOY_DIR/$env"
    if [ ! -d "$build_dir" ]; then
        log "ERROR" "Build directory for $env not found. Run build first."
        return 1
    fi

    # Create backup for rollback
    create_backup "$env"

    # Define the target directory for the new deployment
    local new_deploy_dir="$DEPLOY_DIR/$env/new_deployment"
    local current_deploy_dir="$DEPLOY_DIR/$env/current"

    # Copy the built artifacts to a temporary directory
    mkdir -p "$new_deploy_dir"
    rsync -av --delete "$build_dir/" "$new_deploy_dir/"

    # Deployment logic (Placeholder for actual deployment to remote servers)
    log "INFO" "Starting component deployment..."

    # Backend deployment
    if [ -d "$new_deploy_dir/backend" ]; then
        log "INFO" "Deploying backend..."
        # Replace with actual remote deployment logic (e.g., SSH, Kubernetes apply, etc.)
        log "WARNING" "Backend deployment is a placeholder. Replace with actual remote deployment logic."
    fi

    # Web frontend deployment
    if [ -d "$new_deploy_dir/web-frontend/dist" ] || [ -d "$new_deploy_dir/web-frontend/build" ]; then
        log "INFO" "Deploying web frontend..."
        # Replace with actual remote deployment logic
        log "WARNING" "Web frontend deployment is a placeholder. Replace with actual remote deployment logic."
    fi

    # Blockchain deployment (migration)
    if [ -d "$new_deploy_dir/blockchain" ]; then
        log "INFO" "Deploying blockchain contracts (migration)..."
        # This step usually requires network configuration and keys, which are not handled here.
        # Example: (cd "$new_deploy_dir/blockchain" && npx truffle migrate --network "$env")
        log "WARNING" "Blockchain migration is a placeholder. Replace with actual migration logic."
    fi

    # Atomic switch (simulated)
    log "STEP" "Performing atomic switch to new deployment..."
    # In a real scenario, this would be a symlink switch or load balancer update
    rm -rf "$current_deploy_dir" # Remove old "current" link/dir
    mv "$new_deploy_dir" "$current_deploy_dir" # Make new deployment the "current" one

    log "INFO" "Deployment to $env environment completed successfully."
    return 0
}

# Function to run deployment validation
validate_deployment() {
    local env="$1"

    log "STEP" "Running post-deployment validation for $env environment..."

    # Placeholder for actual validation logic (e.g., health checks, smoke tests)
    log "WARNING" "Deployment validation is a placeholder. Implement actual health checks and smoke tests."

    # Example: Check backend health endpoint
    # if curl -s -f "http://<env-url>/api/health"; then
    #     log "INFO" "Backend health check passed."
    # else
    #     log "ERROR" "Backend health check failed."
    #     return 1
    # fi

    log "INFO" "Post-deployment validation completed successfully."
    return 0
}

# Function to perform rollback
perform_rollback() {
    local env="$1"

    log "STEP" "Performing rollback for $env environment..."

    # Find the latest backup (sorted by mtime, robust to unusual filenames)
    local latest_backup
    latest_backup=$(find "$BACKUP_DIR" -maxdepth 1 -name "$env-*.tar.gz" -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -n 1 | cut -d' ' -f2-)

    if [ -z "$latest_backup" ]; then
        log "ERROR" "No backup found for $env environment. Cannot perform rollback."
        return 1
    fi

    log "INFO" "Found latest backup: $(basename "$latest_backup")"

    # Extract the backup into a staging directory first, so we never touch
    # the live "current" deployment until we know the restore succeeded.
    local restore_staging_dir
    restore_staging_dir="$DEPLOY_DIR/$env/.rollback_staging_$(date +%Y%m%d%H%M%S)"
    mkdir -p "$restore_staging_dir"
    log "INFO" "Extracting backup..."
    tar -xzf "$latest_backup" -C "$restore_staging_dir"

    # The archive contains a top-level "current" directory (see create_backup,
    # which archives "current" relative to $DEPLOY_DIR/$env).
    if [ ! -d "$restore_staging_dir/current" ]; then
        log "ERROR" "Backup archive did not contain the expected 'current' directory."
        rm -rf "$restore_staging_dir"
        return 1
    fi

    log "STEP" "Performing atomic switch to rolled-back deployment..."
    # Archive the failed "current" deployment for debugging rather than
    # deleting it outright, then move the restored version into its place.
    if [ -d "$DEPLOY_DIR/$env/current" ]; then
        mv "$DEPLOY_DIR/$env/current" "$DEPLOY_DIR/$env/current_failed_$(date +%Y%m%d%H%M%S)"
    fi
    mv "$restore_staging_dir/current" "$DEPLOY_DIR/$env/current"
    rm -rf "$restore_staging_dir"

    log "INFO" "Rollback to $(basename "$latest_backup") completed successfully."
    return 0
}

# Function to display usage
usage() {
    echo -e "${BLUE}Usage: $0 <command> <environment>${NC}"
    echo ""
    echo "Commands:"
    echo "  build <env>           Generate config and build all components for the specified environment."
    echo "  deploy <env>          Deploy the latest build to the specified environment."
    echo "  validate <env>        Run post-deployment validation checks."
    echo "  rollback <env>        Rollback to the previous successful deployment."
    echo "  all <env>             Run build, deploy, and validate sequentially."
    echo "  --help                Display this help message."
    echo ""
    echo "Environments: dev, staging, prod"
    echo "Example: $0 all prod"
}

# Main script logic
if [ $# -lt 2 ] && [ "${1:-}" != "--help" ]; then
    usage
    exit 1
fi

COMMAND="$1"
ENV_INPUT="${2:-}"
ENV=""

if [ "$COMMAND" != "--help" ]; then
    ENV=$(validate_environment "$ENV_INPUT")
fi

case "$COMMAND" in
    "build")
        generate_config "$ENV" && \
        build_backend "$ENV" && \
        build_web_frontend "$ENV" && \
        build_blockchain "$ENV"
        ;;
    "deploy")
        deploy_to_environment "$ENV"
        ;;
    "validate")
        validate_deployment "$ENV"
        ;;
    "rollback")
        perform_rollback "$ENV"
        ;;
    "all")
        generate_config "$ENV" && \
        build_backend "$ENV" && \
        build_web_frontend "$ENV" && \
        build_blockchain "$ENV" && \
        deploy_to_environment "$ENV" && \
        validate_deployment "$ENV"
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

log "INFO" "Operation '$COMMAND $ENV' completed successfully."
