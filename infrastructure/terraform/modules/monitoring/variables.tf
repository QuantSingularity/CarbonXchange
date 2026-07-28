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

# --- The following were referenced via var.X throughout main.tf/outputs.tf
# but never declared, which would fail `terraform validate` immediately. ---

variable "cpu_alarm_threshold" {
  description = "CPU utilization percentage that triggers an alarm"
  type        = number
  default     = 80
}

variable "memory_alarm_threshold" {
  description = "Memory utilization percentage that triggers an alarm"
  type        = number
  default     = 80
}

variable "db_cpu_alarm_threshold" {
  description = "Database CPU utilization percentage that triggers an alarm"
  type        = number
  default     = 80
}

variable "db_connection_alarm_threshold" {
  description = "Number of database connections that triggers an alarm"
  type        = number
  default     = 80
}

variable "error_rate_threshold" {
  description = "Number of 5XX errors in a 5-minute period that triggers an alarm"
  type        = number
  default     = 10
}

variable "response_time_threshold" {
  description = "Application response time in seconds that triggers an alarm"
  type        = number
  default     = 2
}

variable "failed_login_threshold" {
  description = "Number of failed login attempts that triggers a security alarm"
  type        = number
  default     = 5
}

variable "suspicious_activity_threshold" {
  description = "Threshold for flagging suspicious account activity"
  type        = number
  default     = 10
}

variable "load_balancer_arn_suffix" {
  description = "ARN suffix of the load balancer, for CloudWatch dimensions"
  type        = string
  default     = ""
}

variable "waf_web_acl_name" {
  description = "Name of the WAF Web ACL to monitor"
  type        = string
  default     = ""
}

variable "api_endpoint_url" {
  description = "URL of the API endpoint for synthetic monitoring"
  type        = string
  default     = ""
}

variable "security_response_lambda_arn" {
  description = "ARN of the Lambda function that handles automated security responses"
  type        = string
  default     = ""
}

variable "enable_automated_response" {
  description = "Whether to enable automated response to security alerts (requires security_response_lambda_arn)"
  type        = bool
  default     = false
}

variable "enable_synthetics" {
  description = "Whether to enable CloudWatch Synthetics canary monitoring"
  type        = bool
  default     = false
}

variable "synthetics_schedule" {
  description = "Schedule expression for the synthetics canary"
  type        = string
  default     = "rate(5 minutes)"
}

variable "enable_xray_tracing" {
  description = "Whether to enable AWS X-Ray tracing"
  type        = bool
  default     = false
}

variable "performance_monitoring_enabled" {
  description = "Whether performance monitoring is enabled (reflected in compliance output)"
  type        = bool
  default     = true
}

variable "business_metrics_enabled" {
  description = "Whether custom business metrics collection is enabled"
  type        = bool
  default     = false
}

variable "compliance_monitoring_enabled" {
  description = "Whether compliance monitoring is enabled"
  type        = bool
  default     = true
}

variable "log_analysis_enabled" {
  description = "Whether automated log analysis is enabled"
  type        = bool
  default     = true
}

variable "audit_trail_enabled" {
  description = "Whether the audit trail is enabled"
  type        = bool
  default     = true
}

variable "regulatory_requirements" {
  description = "List of regulatory frameworks this environment must comply with (e.g. SOC2, PCI-DSS)"
  type        = list(string)
  default     = []
}

variable "cost_monitoring_enabled" {
  description = "Whether cost monitoring and budget alerts are enabled"
  type        = bool
  default     = true
}

variable "cost_alert_threshold_percentage" {
  description = "Percentage of the monthly budget that triggers a cost alert"
  type        = number
  default     = 80
}

variable "monthly_budget_limit" {
  description = "Monthly budget limit in USD for cost alerts"
  type        = number
  default     = 1000
}
