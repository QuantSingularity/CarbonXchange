environment  = "staging"
app_name     = "carbonxchange"
aws_region   = "us-west-2"

vpc_cidr             = "10.1.0.0/16"
availability_zones   = ["us-west-2a", "us-west-2b", "us-west-2c"]
public_subnet_cidrs  = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
private_subnet_cidrs = ["10.1.4.0/24", "10.1.5.0/24", "10.1.6.0/24"]

instance_type     = "t3.medium"
db_instance_class = "db.t3.small"
db_name           = "carbonxchangedb"
db_username       = "appuser"
# db_password set via TF_VAR_db_password environment variable or prompted

default_tags = {
  Terraform   = "true"
  Project     = "CarbonXchange"
  Environment = "staging"
  ManagedBy   = "Terraform"
}
