# Database Module Variables for Financial Standards Compliance

variable "db_name" {
  description = "Name of the database"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Network Configuration
variable "private_subnet_ids" {
  description = "List of private subnet IDs for the database subnet group"
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs for the database"
  type        = list(string)
}

variable "port" {
  description = "Port on which the database accepts connections"
  type        = number
  default     = 5432
}

# Database Engine Configuration
variable "engine" {
  description = "Database engine"
  type        = string
  default     = "postgres"
  validation {
    condition     = contains(["mysql", "postgres", "mariadb"], var.engine)
    error_message = "Engine must be one of: mysql, postgres, mariadb."
  }
}

variable "engine_version" {
  description = "Database engine version"
  type        = string
  default     = "15.4"
}

variable "major_engine_version" {
  description = "Major version of the database engine"
  type        = string
  default     = "15"
}

variable "parameter_group_family" {
  description = "Database parameter group family"
  type        = string
  default     = "postgres15"
}

# Instance Configuration
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "allocated_storage" {
  description = "Initial allocated storage in GB"
  type        = number
  default     = 100
  validation {
    condition     = var.allocated_storage >= 20
    error_message = "Allocated storage must be at least 20 GB."
  }
}

variable "max_allocated_storage" {
  description = "Maximum allocated storage for autoscaling in GB"
  type        = number
  default     = 1000
}

variable "storage_type" {
  description = "Storage type"
  type        = string
  default     = "gp3"
  validation {
    condition     = contains(["gp2", "gp3", "io1", "io2"], var.storage_type)
    error_message = "Storage type must be one of: gp2, gp3, io1, io2."
  }
}

variable "iops" {
  description = "IOPS for io1/io2 storage types"
  type        = number
  default     = null
}

variable "storage_throughput" {
  description = "Storage throughput for gp3 storage type"
  type        = number
  default     = null
}

# Database Credentials
variable "db_username" {
  description = "Master username for the database"
  type        = string
  default     = "admin"
  sensitive   = true
}

variable "db_password" {
  description = "Master password for the database (leave empty for auto-generation)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "manage_master_user_password" {
  description = "Set to true to allow RDS to manage the master user password in Secrets Manager"
  type        = bool
  default     = true
}

# Encryption Configuration
variable "kms_key_id" {
  description = "KMS key ID for encryption (leave empty to create new key)"
  type        = string
  default     = ""
}

variable "kms_deletion_window" {
  description = "Number of days before KMS key deletion"
  type        = number
  default     = 30
  validation {
    condition     = var.kms_deletion_window >= 7 && var.kms_deletion_window <= 30
    error_message = "KMS deletion window must be between 7 and 30 days."
  }
}

# Backup Configuration
variable "backup_retention_period" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 2555 # 7 years for financial compliance
  validation {
    condition     = var.backup_retention_period >= 0 && var.backup_retention_period <= 35
    error_message = "Backup retention period must be between 0 and 35 days."
  }
}

variable "backup_window" {
  description = "Preferred backup window (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "copy_tags_to_snapshot" {
  description = "Copy tags to snapshots"
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot when deleting"
  type        = bool
  default     = false
}

# Maintenance Configuration
variable "maintenance_window" {
  description = "Preferred maintenance window (UTC)"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "auto_minor_version_upgrade" {
  description = "Enable automatic minor version upgrades"
  type        = bool
  default     = false # Disabled for financial environments for stability
}

variable "allow_major_version_upgrade" {
  description = "Allow major version upgrades"
  type        = bool
  default     = false
}

# High Availability Configuration
variable "multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = true
}

variable "availability_zone" {
  description = "Availability zone for single-AZ deployment"
  type        = string
  default     = null
}

# Monitoring Configuration
variable "monitoring_interval" {
  description = "Monitoring interval in seconds (0 to disable)"
  type        = number
  default     = 60
  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be one of: 0, 1, 5, 10, 15, 30, 60."
  }
}

variable "performance_insights_enabled" {
  description = "Enable Performance Insights"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "Performance Insights retention period in days"
  type        = number
  default     = 731 # 2 years
  validation {
    condition     = contains([7, 731], var.performance_insights_retention_period)
    error_message = "Performance Insights retention period must be 7 or 731 days."
  }
}

variable "enabled_cloudwatch_logs_exports" {
  description = "List of log types to export to CloudWatch"
  type        = list(string)
  default     = ["postgresql", "upgrade"]
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 2555 # 7 years for financial compliance
}

# Security Configuration
variable "ca_cert_identifier" {
  description = "CA certificate identifier for SSL connections"
  type        = string
  default     = "rds-ca-rsa2048-g1"
}

# Database Parameters
variable "db_parameters" {
  description = "List of database parameters to apply"
  type = list(object({
    name  = string
    value = string
  }))
  default = [
    {
      name  = "innodb_buffer_pool_size"
      value = "{DBInstanceClassMemory*3/4}"
    },
    {
      name  = "max_allowed_packet"
      value = "1073741824"
    },
    {
      name  = "innodb_log_file_size"
      value = "268435456"
    }
  ]
}

variable "slow_query_log_threshold" {
  description = "Slow query log threshold in seconds"
  type        = string
  default     = "2"
}

variable "max_connections" {
  description = "Maximum number of connections"
  type        = string
  default     = "1000"
}

variable "connect_timeout" {
  description = "Connection timeout in seconds"
  type        = string
  default     = "10"
}

variable "wait_timeout" {
  description = "Wait timeout in seconds"
  type        = string
  default     = "28800"
}

variable "interactive_timeout" {
  description = "Interactive timeout in seconds"
  type        = string
  default     = "28800"
}

# Option Group Configuration
variable "create_option_group" {
  description = "Create custom option group"
  type        = bool
  default     = false
}

variable "db_options" {
  description = "List of database options to apply"
  type = list(object({
    option_name = string
    option_settings = list(object({
      name  = string
      value = string
    }))
  }))
  default = []
}

# Read Replica Configuration
variable "create_read_replica" {
  description = "Create read replicas"
  type        = bool
  default     = true
}

variable "read_replica_count" {
  description = "Number of read replicas to create"
  type        = number
  default     = 2
}

variable "read_replica_instance_class" {
  description = "Instance class for read replicas"
  type        = string
  default     = "db.t3.medium"
}

variable "read_replica_allocated_storage" {
  description = "Allocated storage for read replicas in GB"
  type        = number
  default     = null
}

variable "read_replica_max_allocated_storage" {
  description = "Maximum allocated storage for read replicas in GB"
  type        = number
  default     = null
}

variable "read_replica_storage_type" {
  description = "Storage type for read replicas"
  type        = string
  default     = "gp3"
}

variable "read_replica_iops" {
  description = "IOPS for read replica io1/io2 storage"
  type        = number
  default     = null
}

variable "read_replica_availability_zones" {
  description = "Availability zones for read replicas"
  type        = list(string)
  default     = []
}

variable "read_replica_monitoring_interval" {
  description = "Monitoring interval for read replicas"
  type        = number
  default     = 60
}

variable "read_replica_performance_insights_enabled" {
  description = "Enable Performance Insights for read replicas"
  type        = bool
  default     = true
}

variable "read_replica_deletion_protection" {
  description = "Enable deletion protection for read replicas"
  type        = bool
  default     = true
}

variable "read_replica_skip_final_snapshot" {
  description = "Skip final snapshot for read replicas"
  type        = bool
  default     = false
}

variable "read_replica_maintenance_window" {
  description = "Maintenance window for read replicas"
  type        = string
  default     = "sun:05:00-sun:06:00"
}

variable "read_replica_auto_minor_version_upgrade" {
  description = "Enable automatic minor version upgrades for read replicas"
  type        = bool
  default     = false
}

# Database Proxy Configuration
variable "create_db_proxy" {
  description = "Create RDS Proxy"
  type        = bool
  default     = true
}

variable "proxy_engine_family" {
  description = "Engine family for RDS Proxy"
  type        = string
  default     = "POSTGRESQL"
}

variable "proxy_idle_client_timeout" {
  description = "Idle client timeout for RDS Proxy in seconds"
  type        = number
  default     = 1800
}

variable "proxy_max_connections_percent" {
  description = "Maximum connections percent for RDS Proxy"
  type        = number
  default     = 100
}

variable "proxy_max_idle_connections_percent" {
  description = "Maximum idle connections percent for RDS Proxy"
  type        = number
  default     = 50
}

variable "proxy_connection_borrow_timeout" {
  description = "Connection borrow timeout for RDS Proxy in seconds"
  type        = number
  default     = 120
}

variable "proxy_init_query" {
  description = "Initial query for RDS Proxy connections"
  type        = string
  default     = ""
}

variable "proxy_session_pinning_filters" {
  description = "Session pinning filters for RDS Proxy"
  type        = list(string)
  default     = []
}

# Secrets Manager Configuration
variable "secret_recovery_window" {
  description = "Number of days for secret recovery window"
  type        = number
  default     = 30
  validation {
    condition     = var.secret_recovery_window >= 7 && var.secret_recovery_window <= 30
    error_message = "Secret recovery window must be between 7 and 30 days."
  }
}

# Backup S3 Configuration
variable "create_backup_bucket" {
  description = "Create S3 bucket for additional database backups"
  type        = bool
  default     = true
}

# Compliance Configuration
variable "compliance_standards" {
  description = "List of compliance standards this database must meet"
  type        = list(string)
  default     = ["PCI-DSS", "SOX", "GDPR", "ISO-27001"]
}

variable "data_classification" {
  description = "Data classification level"
  type        = string
  default     = "confidential"
  validation {
    condition     = contains(["public", "internal", "confidential", "restricted"], var.data_classification)
    error_message = "Data classification must be one of: public, internal, confidential, restricted."
  }
}

# Environment-specific Configuration
variable "environment_config" {
  description = "Environment-specific database configuration"
  type = map(object({
    instance_class               = string
    allocated_storage            = number
    backup_retention_period      = number
    multi_az                     = bool
    deletion_protection          = bool
    performance_insights_enabled = bool
    monitoring_interval = number
  }))
  default = {
    dev = {
      instance_class               = "db.t3.micro"
      allocated_storage            = 20
      backup_retention_period      = 7
      multi_az                     = false
      deletion_protection          = false
      performance_insights_enabled = false
      monitoring_interval = 0
    }
    staging = {
      instance_class               = "db.t3.small"
      allocated_storage            = 50
      backup_retention_period      = 30
      multi_az                     = true
      deletion_protection          = true
      performance_insights_enabled = true
      monitoring_interval = 60
    }
    prod = {
      instance_class               = "db.r5.large"
      allocated_storage            = 100
      backup_retention_period      = 35
      multi_az                     = true
      deletion_protection          = true
      performance_insights_enabled = true
      monitoring_interval = 60
    }
  }
}

# Cost Optimization
variable "cost_optimization_enabled" {
  description = "Enable cost optimization features"
  type        = bool
  default     = true
}

variable "reserved_instance_enabled" {
  description = "Use reserved instances for cost savings"
  type        = bool
  default     = false
}

# Disaster Recovery Configuration
variable "cross_region_backup_enabled" {
  description = "Enable cross-region automated backups"
  type        = bool
  default     = true
}

variable "backup_destination_region" {
  description = "Destination region for cross-region backups"
  type        = string
  default     = ""
}

# Audit Configuration
variable "audit_log_enabled" {
  description = "Enable database audit logging"
  type        = bool
  default     = true
}

variable "audit_log_retention_days" {
  description = "Number of days to retain audit logs"
  type        = number
  default     = 2555 # 7 years
}

# Performance Configuration
variable "connection_pooling_enabled" {
  description = "Enable connection pooling via RDS Proxy"
  type        = bool
  default     = true
}

variable "query_performance_insights_enabled" {
  description = "Enable query performance insights"
  type        = bool
  default     = true
}

# Security Hardening
variable "ssl_enforcement_enabled" {
  description = "Enforce SSL connections"
  type        = bool
  default     = true
}

variable "transparent_data_encryption_enabled" {
  description = "Enable transparent data encryption"
  type        = bool
  default     = true
}

variable "network_encryption_enabled" {
  description = "Enable network encryption in transit"
  type        = bool
  default     = true
}
