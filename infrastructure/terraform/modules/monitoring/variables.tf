# Monitoring Module Variables for Financial Standards Compliance

variable "app_name" {
  description = "Name of the application"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
  default     = ""
}

variable "private_subnet_ids" {
  description = "IDs of the private subnets"
  type        = list(string)
  default     = []
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "kms_key_arn" {
  description = "ARN of the KMS key for encryption"
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "Number of days to retain application logs"
  type        = number
  default     = 2555
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 2555, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch Logs retention period."
  }
}

variable "security_log_retention_days" {
  description = "Number of days to retain security logs"
  type        = number
  default     = 2555
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 2555, 3653], var.security_log_retention_days)
    error_message = "Security log retention days must be a valid CloudWatch Logs retention period."
  }
}

variable "audit_log_retention_days" {
  description = "Number of days to retain audit logs"
  type        = number
  default     = 2555
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 2555, 3653], var.audit_log_retention_days)
    error_message = "Audit log retention days must be a valid CloudWatch Logs retention period."
  }
}

variable "instance_id" {
  description = "EC2 instance ID for monitoring"
  type        = string
  default     = ""
}

variable "db_instance_identifier" {
  description = "RDS instance identifier for monitoring"
  type        = string
  default     = ""
}

variable "alert_email_addresses" {
  description = "List of email addresses for general alerts"
  type        = list(string)
  default     = []
}

variable "critical_alert_email_addresses" {
  description = "List of email addresses for critical alerts"
  type        = list(string)
  default     = []
}

variable "security_alert_email_addresses" {
  description = "List of email addresses for security alerts"
  type        = list(string)
  default     = []
}
