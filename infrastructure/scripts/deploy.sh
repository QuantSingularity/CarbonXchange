#!/bin/bash

# CarbonXchange Infrastructure Deployment Script
# This script deploys the comprehensive infrastructure for financial compliance

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-staging}"
TERRAFORM_DIR="$INFRA_DIR/terraform"
KUBERNETES_DIR="$INFRA_DIR/kubernetes"
ANSIBLE_DIR="$INFRA_DIR/ansible"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Validation functions
validate_environment() {
    if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be dev, staging, or prod."
        exit 1
    fi
}

validate_prerequisites() {
    log_info "Validating prerequisites..."

    local tools=("terraform" "kubectl" "ansible" "aws" "jq")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed or not in PATH"
            exit 1
        fi
    done

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        exit 1
    fi

    # Check Terraform version (>= 1.5.0)
    local tf_version
    tf_version=$(terraform version -json | jq -r '.terraform_version')
    local min_version="1.5.0"
    if [[ "$(printf '%s\n' "$min_version" "$tf_version" | sort -V | head -n1)" != "$min_version" ]]; then
        log_error "Terraform version must be >= $min_version. Current: $tf_version"
        exit 1
    fi

    log_success "Prerequisites validated"
}

validate_terraform_config() {
    log_info "Validating Terraform configuration..."

    cd "$TERRAFORM_DIR"

    local tfvars_file="environments/$ENVIRONMENT/terraform.tfvars"
    if [[ ! -f "$tfvars_file" ]]; then
        log_error "Terraform variables file not found: $tfvars_file"
        exit 1
    fi

    terraform init -backend=false -input=false &> /dev/null
    if ! terraform validate; then
        log_error "Terraform configuration validation failed"
        exit 1
    fi

    log_success "Terraform configuration validated"
}

# Deployment functions
deploy_terraform() {
    log_info "Deploying Terraform infrastructure for $ENVIRONMENT..."

    cd "$TERRAFORM_DIR"

    terraform init -input=false

    log_info "Creating Terraform plan..."
    terraform plan \
        -var-file="environments/$ENVIRONMENT/terraform.tfvars" \
        -out="$ENVIRONMENT.tfplan" \
        -input=false

    if [[ "$ENVIRONMENT" == "prod" ]]; then
        echo
        log_warning "You are about to deploy to PRODUCTION environment!"
        read -r -p "Are you sure you want to continue? (yes/no): " confirm
        if [[ "$confirm" != "yes" ]]; then
            log_info "Deployment cancelled"
            rm -f "$ENVIRONMENT.tfplan"
            exit 0
        fi
    fi

    log_info "Applying Terraform configuration..."
    terraform apply -input=false "$ENVIRONMENT.tfplan"

    rm -f "$ENVIRONMENT.tfplan"

    log_success "Terraform infrastructure deployed"
}

deploy_kubernetes() {
    log_info "Deploying Kubernetes configurations for $ENVIRONMENT..."

    cd "$KUBERNETES_DIR"

    local namespace="carbonxchange"

    # Apply pod security standards (creates the namespace with labels)
    log_info "Applying namespace and pod security standards..."
    kubectl apply -f security/pod-security-standards.yaml

    # Apply RBAC configurations
    log_info "Applying RBAC policies..."
    kubectl apply -f security/rbac.yaml

    # Apply network policies
    log_info "Applying network policies..."
    kubectl apply -f security/network-policies.yaml

    # Apply base configurations (namespace comes from each manifest's metadata)
    log_info "Applying base configurations..."
    kubectl apply -f base/

    # Apply compliance configurations
    log_info "Applying compliance configurations..."
    kubectl apply -f compliance/

    # Apply environment-specific configurations
    if [[ -d "environments/$ENVIRONMENT" ]]; then
        log_info "Applying environment-specific configurations..."
        # Values files are consumed by Helm/templating, not applied directly
        log_info "Note: environment values files are used by Helm chart rendering"
    fi

    log_success "Kubernetes configurations deployed"
}

deploy_ansible() {
    log_info "Running Ansible playbooks for $ENVIRONMENT..."

    cd "$ANSIBLE_DIR"

    local inventory_file="inventory/hosts.yml"
    if [[ ! -f "$inventory_file" ]]; then
        log_warning "Ansible inventory file not found: $inventory_file. Skipping Ansible deployment."
        return 0
    fi

    # Install required collections
    if [[ -f "requirements.yml" ]]; then
        log_info "Installing Ansible collections..."
        ansible-galaxy collection install -r requirements.yml
    fi

    ansible-playbook \
        -i "$inventory_file" \
        playbooks/main.yml \
        --extra-vars "environment=$ENVIRONMENT" \
        --diff

    log_success "Ansible playbooks executed"
}

verify_deployment() {
    log_info "Verifying deployment for $ENVIRONMENT..."

    local namespace="carbonxchange"

    # Verify Kubernetes resources
    log_info "Verifying Kubernetes resources..."
    kubectl get all -n "$namespace" 2>/dev/null || log_warning "Namespace $namespace not yet available"

    # Check pod status — filter out Completed pods (e.g. migration init containers)
    local failed_pods
    failed_pods=$(kubectl get pods -n "$namespace" \
        --field-selector="status.phase!=Running,status.phase!=Succeeded" \
        --no-headers 2>/dev/null | wc -l)
    if [[ "$failed_pods" -gt 0 ]]; then
        log_warning "$failed_pods pods are not in Running/Succeeded state:"
        kubectl get pods -n "$namespace" \
            --field-selector="status.phase!=Running,status.phase!=Succeeded" 2>/dev/null || true
    fi

    # Verify network policies
    log_info "Verifying network policies..."
    kubectl get networkpolicy -n "$namespace" 2>/dev/null || true

    log_success "Deployment verification completed"
}

cleanup() {
    cd "$TERRAFORM_DIR" 2>/dev/null && rm -f "$ENVIRONMENT.tfplan" || true
}

main() {
    log_info "Starting CarbonXchange infrastructure deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

    validate_environment
    validate_prerequisites
    validate_terraform_config

    deploy_terraform
    deploy_kubernetes
    deploy_ansible

    verify_deployment

    log_success "CarbonXchange infrastructure deployment completed successfully!"
    log_info "Environment: $ENVIRONMENT"
    log_info "Completed at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

    echo
    log_info "Important URLs:"
    echo "  - AWS Console:          https://console.aws.amazon.com/"
    echo "  - Kubernetes Dashboard: kubectl proxy"
    echo "  - Logs:                 CloudWatch Log Groups /carbonxchange/$ENVIRONMENT"
    echo
    log_info "Next steps:"
    echo "  1. Verify all pods are Running: kubectl get pods -n carbonxchange"
    echo "  2. Check application health endpoints"
    echo "  3. Run security scans"
    echo "  4. Validate compliance requirements"
}

trap cleanup EXIT
trap 'log_error "Deployment failed at line $LINENO. Exit code: $?"' ERR

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
