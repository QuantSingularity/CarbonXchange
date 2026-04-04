environment  = "prod"
app_name     = "carbonxchange"
aws_region   = "us-west-2"

vpc_cidr             = "10.2.0.0/16"
availability_zones   = ["us-west-2a", "us-west-2b", "us-west-2c"]
public_subnet_cidrs  = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]
private_subnet_cidrs = ["10.2.4.0/24", "10.2.5.0/24", "10.2.6.0/24"]

instance_type     = "t3.large"
db_instance_class = "db.r6g.xlarge"
db_name           = "carbonxchangedb"
db_username       = "appuser"
# db_password set via TF_VAR_db_password environment variable — never stored here

default_tags = {
  Terraform   = "true"
  Project     = "CarbonXchange"
  Environment = "prod"
  ManagedBy   = "Terraform"
  CostCenter  = "carbonxchange-prod"
}
