-- CarbonXchange database initialization
-- This script runs once on first container start

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Ensure the database uses proper charset
ALTER DATABASE carbonxchangedb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Remove anonymous users and test database (security hardening)
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';
DROP DATABASE IF EXISTS test;

-- Ensure app user has correct grants only on its own database
REVOKE ALL PRIVILEGES ON *.* FROM IF EXISTS 'appuser'@'%';
FLUSH PRIVILEGES;
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, CREATE TEMPORARY TABLES, LOCK TABLES
  ON carbonxchangedb.* TO 'appuser'@'%';
FLUSH PRIVILEGES;
