# CarbonXchange Infrastructure

## Overview

This directory contains the infrastructure code for CarbonXchange. All critical security issues have been addressed, deprecated APIs updated, and best practices implemented.

## Quick Start

### Prerequisites

Install the following tools:

```bash
# Terraform (1.6.6 or later)
wget https://releases.hashicorp.com/terraform/1.6.6/terraform_1.6.6_linux_amd64.zip
unzip terraform_1.6.6_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# kubectl (1.28.0 or later)
curl -LO "https://dl.k8s.io/release/v1.28.0/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# Ansible (2.15.0 or later) & tools
pip install ansible>=2.15.0 ansible-lint yamllint

# Install Ansible collections
ansible-galaxy collection install -r ansible/requirements.yml

# AWS CLI (if using AWS)
pip install awscli
```

### 1. Terraform Setup & Validation

```bash
cd terraform

# Copy example tfvars and configure
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values (DO NOT commit this file)

# Format check
terraform fmt -check -recursive

# Initialize
terraform init -backend=false

# Validate
terraform validate

# Plan (requires variables)
export TF_VAR_db_password="your-secure-password"
terraform plan -var-file="terraform.tfvars" -out=plan.out

# Apply (in actual deployment)
# terraform apply plan.out
```

### 2. Kubernetes Setup & Validation

This is a Helm chart (`Chart.yaml` + `templates/` + per-environment
`values.yaml`), not a set of raw manifests — the `{{ .Values.x }}`
placeholders throughout `templates/` require Helm to render before
`kubectl` can do anything with them.

```bash
cd kubernetes

# Copy example values
cp environments/dev/values.yaml.example environments/dev/values.yaml
# Edit values.yaml with your secrets (DO NOT commit this file)

# Validate YAML syntax of the source templates (won't catch unresolved
# {{ }} expressions — see helm lint/template below for that)
yamllint -c ../.yamllint .

# Lint the chart itself
helm lint . -f environments/dev/values.yaml

# Render + dry-run validate against a real cluster schema
helm template carbonxchange . -f environments/dev/values.yaml | kubectl apply --dry-run=client -f -

# Static, non-templated cluster policies (RBAC, network policies, pod
# security standards) apply directly with kubectl, no Helm involved
kubectl apply --dry-run=client -f security/

# Apply to cluster (actual deployment)
# helm install carbonxchange . -f environments/dev/values.yaml --namespace carbonxchange --create-namespace
# kubectl apply -f security/pod-security-standards.yaml
```

### 3. Ansible Setup & Validation

```bash
cd ansible

# Install required collections
ansible-galaxy collection install -r requirements.yml

# Copy inventory example
cp inventory/hosts.yml.example inventory/hosts.yml
# Edit with your server IPs (DO NOT commit this file)

# Create vault for secrets
echo "your-vault-password" > .vault_pass
chmod 600 .vault_pass
ansible-vault create group_vars/all/vault.yml

# Lint playbooks
ansible-lint playbooks/ roles/

# Dry-run playbooks
ansible-playbook -i inventory/hosts.yml playbooks/main.yml --check

# Run playbooks (actual deployment)
# ansible-playbook -i inventory/hosts.yml playbooks/main.yml --vault-password-file .vault_pass
```

### 4. CI/CD Validation

```bash
# Validate workflow syntax (the workflow lives at the repo root, not here)
yamllint ../.github/workflows/cicd.yml

# Local testing with act (optional)
# act -W ../.github/workflows/cicd.yml --job infrastructure-lint
```

## Environment Variables for Secrets

**NEVER commit secrets to git.** Use one of these methods:

### Method 1: Environment Variables (Recommended for CI/CD)

```bash
# Terraform
export TF_VAR_db_password="your-secure-password"
export TF_VAR_db_username="your-username"

# Ansible
export ANSIBLE_VAULT_PASSWORD_FILE=.vault_pass
```

### Method 2: AWS Secrets Manager (Recommended for Production)

```hcl
# In Terraform
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "carbonxchange/db/password"
}

variable "db_password" {
  default = data.aws_secretsmanager_secret_version.db_password.secret_string
}
```

### Method 3: Kubernetes Sealed Secrets

```bash
# Install sealed-secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Seal your secrets
kubeseal --format yaml < secret.yaml > sealed-secret.yaml
```

## Validation Commands (Copy-Paste Ready)

### Complete Validation Suite

```bash
# Run all validations
cd infrastructure

# 1. Terraform
cd terraform
terraform fmt -recursive
terraform init -backend=false
terraform validate
cd ..

# 2. Kubernetes YAML + Helm chart
yamllint -c .yamllint kubernetes/
cd kubernetes && helm lint . -f environments/dev/values.yaml && cd ..

# 3. Ansible
cd ansible
ansible-lint playbooks/ roles/
cd ..

# 4. CI/CD
yamllint ../.github/workflows/cicd.yml

echo "✅ All validations passed"
```

### Individual Tool Validations

```bash
# Terraform only
terraform -chdir=terraform fmt -check -recursive && echo "✓ Format OK"
terraform -chdir=terraform validate && echo "✓ Validate OK"

# Kubernetes only (render the Helm chart, then dry-run validate)
cd kubernetes && helm template carbonxchange . -f environments/dev/values.yaml | kubectl apply --dry-run=client -f - && cd ..

# Ansible only
ansible-playbook ansible/playbooks/main.yml --syntax-check
```

## File Structure

```
infrastructure/
├── README.md                    # This file
├── .gitignore                   # Comprehensive gitignore
├── .yamllint                    # YAML linting config
│
├── terraform/
│   ├── main.tf                  # Main terraform configuration
│   ├── variables.tf             # Variable definitions
│   ├── outputs.tf               # Output values
│   ├── terraform.tfvars.example # Example variables (copy to terraform.tfvars)
│   ├── environments/            # Environment-specific configs
│   └── modules/                 # Reusable terraform modules
│
├── kubernetes/                  # Helm chart
│   ├── Chart.yaml                # Chart metadata
│   ├── values.yaml               # Default values (mirrors environments/dev)
│   ├── templates/                # Templated Kubernetes manifests
│   ├── security/                # Security policies (static, applied directly with kubectl)
│   │   ├── pod-security-standards.yaml  # Modern PSS (replaces deprecated PSP)
│   │   ├── network-policies.yaml
│   │   ├── rbac.yaml
│   │   └── legacy/              # Deprecated files for reference
│   ├── environments/            # Environment-specific values
│   │   └── */values.yaml.example
│   └── compliance/              # Compliance configurations
│
├── ansible/
│   ├── playbooks/               # Ansible playbooks
│   ├── roles/                   # Ansible roles (fixed FQCN)
│   ├── inventory/
│   │   └── hosts.yml.example    # Inventory example
│   ├── requirements.yml         # Ansible Galaxy collections
│   ├── group_vars/
│   │   └── all/vault.yml.example # Vault example
│   └── .vault_pass.example      # Vault password instructions
│
└── scripts/
    └── deploy.sh                # Deployment automation
```

Note: the CI/CD workflow lives at the repository root
(`.github/workflows/cicd.yml`), not inside `infrastructure/`.

## Security Best Practices

1. **Secrets Management**
   - Use AWS Secrets Manager or HashiCorp Vault for production
   - Use Ansible Vault for configuration management
   - Use Kubernetes Sealed Secrets or External Secrets Operator
   - Never commit `.tfvars`, `values.yaml`, or `hosts.yml`

2. **Access Control**
   - Use MFA for all administrative access
   - Implement least-privilege IAM roles
   - Rotate credentials regularly (90 days recommended)
   - Use service accounts with minimal permissions

3. **Network Security**
   - Enable VPC Flow Logs
   - Use private subnets for databases and internal services
   - Implement Network Policies in Kubernetes
   - Enable WAF and Shield for public endpoints

4. **Monitoring & Audit**
   - Enable CloudTrail/audit logs
   - Set up alerts for security events
   - Monitor for configuration drift
   - Regular security assessments

## Troubleshooting

### Terraform Issues

**Issue**: `terraform validate` fails with module errors

```bash
# Solution: Re-initialize
terraform init -backend=false -upgrade
```

**Issue**: Provider version conflicts

```bash
# Solution: Update lock file
rm .terraform.lock.hcl
terraform init -backend=false
```

### Kubernetes Issues

**Issue**: Pod fails with security context error

```bash
# Check Pod Security Standards
kubectl get namespace carbonxchange -o yaml | grep pod-security

# View policy violations
kubectl describe pod <pod-name>
```

**Issue**: Image pull errors

```bash
# Create image pull secret
kubectl create secret docker-registry regcred \
  --docker-server=<registry> \
  --docker-username=<username> \
  --docker-password=<password>
```

### Ansible Issues

**Issue**: `mysql_user` module not found

```bash
# Install required collection
ansible-galaxy collection install community.mysql
```

**Issue**: Vault password errors

```bash
# Verify vault password file
cat .vault_pass  # Should contain only the password
chmod 600 .vault_pass
```

---
