# Configuration Guide

Complete configuration reference for CarbonXchange platform. This guide covers all environment variables, configuration files, and system settings.

## Table of Contents

- [Configuration Files](#configuration-files)
- [Environment Variables](#environment-variables)
- [Application Configuration](#application-configuration)
- [Database Configuration](#database-configuration)
- [Blockchain Configuration](#blockchain-configuration)
- [Security Configuration](#security-configuration)
- [Feature Flags](#feature-flags)
- [Email and Notifications](#email-and-notifications)
- [External Services](#external-services)

## Configuration Files

CarbonXchange uses multiple configuration files:

| File                 | Purpose               | Location                        | Format     |
| -------------------- | --------------------- | ------------------------------- | ---------- |
| `.env`               | Environment variables | Repository root, code/backend/  | KEY=value  |
| `config.py`          | Application config    | code/backend/src/config.py      | Python     |
| `truffle-config.js`  | Blockchain config     | code/blockchain/                | JavaScript |
| `package.json`       | Node.js config        | web-frontend/, mobile-frontend/ | JSON       |
| `docker-compose.yml` | Docker services       | Repository root                 | YAML       |

## Environment Variables

### Core Application Settings

| Option           | Type    |     Default      | Description                                       | Where to set (env/file) |
| ---------------- | ------- | :--------------: | ------------------------------------------------- | ----------------------- |
| `FLASK_ENV`      | string  |  `development`   | Application environment (development, production) | .env                    |
| `SECRET_KEY`     | string  | (auto-generated) | Flask secret key for sessions                     | .env                    |
| `JWT_SECRET_KEY` | string  | (auto-generated) | JWT token signing key                             | .env                    |
| `PORT`           | integer |      `5000`      | Backend API server port                           | .env                    |
| `DEBUG`          | boolean |     `false`      | Enable debug mode                                 | .env                    |
| `LOG_LEVEL`      | string  |      `INFO`      | Logging level (DEBUG, INFO, WARNING, ERROR)       | .env                    |

**Example Configuration:**

```bash
# .env file
FLASK_ENV=development
SECRET_KEY=your-secret-key-here-change-in-production
JWT_SECRET_KEY=your-jwt-secret-key-change-in-production
PORT=5000
DEBUG=false
LOG_LEVEL=INFO
```

### Database Configuration

| Option                    | Type    |            Default            | Description                       | Where to set      |
| ------------------------- | ------- | :---------------------------: | --------------------------------- | ----------------- |
| `DATABASE_URL`            | string  | `sqlite:///./database/dev.db` | Database connection string        | .env              |
| `SQLALCHEMY_POOL_SIZE`    | integer |             `20`              | Connection pool size              | .env or config.py |
| `SQLALCHEMY_MAX_OVERFLOW` | integer |             `10`              | Max overflow connections          | .env or config.py |
| `SQLALCHEMY_POOL_TIMEOUT` | integer |             `20`              | Pool timeout in seconds           | .env or config.py |
| `SQLALCHEMY_POOL_RECYCLE` | integer |             `300`             | Connection recycle time (seconds) | .env or config.py |

**Database URL Formats:**

```bash
# PostgreSQL (Recommended for production)
DATABASE_URL=postgresql://username:password@localhost:5432/carbonxchange

# PostgreSQL with pg_bouncer
DATABASE_URL=postgresql://user:pass@pgbouncer:6432/carbonxchange

# SQLite (Development only)
DATABASE_URL=sqlite:///./database/dev.db
```

Note: the backend only ships the PostgreSQL driver (`psycopg2-binary` in
`code/backend/requirements.txt`). Other SQLAlchemy-supported engines (MySQL,
etc.) would need their own driver added to `requirements.txt` first — none
is included by default.

### Redis Configuration

| Option                  | Type   |          Default           | Description              | Where to set |
| ----------------------- | ------ | :------------------------: | ------------------------ | ------------ |
| `REDIS_URL`             | string | `redis://localhost:6379/0` | Redis connection URL     | .env         |
| `CELERY_BROKER_URL`     | string | `redis://localhost:6379/2` | Celery task queue broker | .env         |
| `CELERY_RESULT_BACKEND` | string | `redis://localhost:6379/3` | Celery result storage    | .env         |
| `RATELIMIT_STORAGE_URL` | string |    (same as REDIS_URL)     | Rate limiting storage    | .env         |

**Redis URL Formats:**

```bash
# Local Redis
REDIS_URL=redis://localhost:6379/0

# Redis with password
REDIS_URL=redis://:password@localhost:6379/0

# Redis Sentinel
REDIS_URL=redis+sentinel://sentinel1:26379,sentinel2:26379/mymaster/0

# Redis Cluster
REDIS_URL=redis://cluster1:6379,cluster2:6379,cluster3:6379/0
```

## Application Configuration

### JWT Token Settings

| Option                      | Type      |   Default    | Description            | Where to set |
| --------------------------- | --------- | :----------: | ---------------------- | ------------ |
| `JWT_ACCESS_TOKEN_EXPIRES`  | timedelta | `15 minutes` | Access token lifetime  | config.py    |
| `JWT_REFRESH_TOKEN_EXPIRES` | timedelta |   `7 days`   | Refresh token lifetime | config.py    |
| `JWT_ALGORITHM`             | string    |   `HS256`    | JWT signing algorithm  | config.py    |
| `JWT_BLACKLIST_ENABLED`     | boolean   |    `true`    | Enable token blacklist | config.py    |

Edit in `code/backend/src/config.py`:

```python
JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
JWT_ALGORITHM = "HS256"
```

### CORS Settings

| Option               | Type   |     Default      | Description                       | Where to set |
| -------------------- | ------ | :--------------: | --------------------------------- | ------------ |
| `CORS_ORIGINS`       | string |       `*`        | Allowed origins (comma-separated) | .env         |
| `CORS_METHODS`       | list   |  (all methods)   | Allowed HTTP methods              | config.py    |
| `CORS_ALLOW_HEADERS` | list   | (common headers) | Allowed request headers           | config.py    |

**Production CORS Configuration:**

```bash
# .env
CORS_ORIGINS=https://app.carbonxchange.com,https://www.carbonxchange.com
```

### Rate Limiting

| Option                    | Type   |      Default      | Description               | Where to set |
| ------------------------- | ------ | :---------------: | ------------------------- | ------------ |
| `RATELIMIT_DEFAULT`       | string |  `1000 per hour`  | Default rate limit        | config.py    |
| `RATELIMIT_AUTH_LOGIN`    | string |  `5 per minute`   | Login attempt limit       | config.py    |
| `RATELIMIT_AUTH_REGISTER` | string |  `3 per minute`   | Registration limit        | config.py    |
| `RATELIMIT_TRADING_ORDER` | string | `100 per minute`  | Order creation limit      | config.py    |
| `RATELIMIT_MARKET_DATA`   | string | `1000 per minute` | Market data request limit | config.py    |

## Blockchain Configuration

### Web3 Provider Settings

| Option                      | Type    |          Default          | Description                        | Where to set |
| --------------------------- | ------- | :-----------------------: | ---------------------------------- | ------------ |
| `WEB3_PROVIDER_URL`         | string  |        (required)         | Ethereum/Polygon RPC URL           | .env         |
| `WEB3_PRIVATE_KEY`          | string  | (required for operations) | Private key for transactions       | .env         |
| `WEB3_CHAIN_ID`             | integer |           `137`           | Chain ID (137=Polygon, 1=Ethereum) | .env         |
| `WEB3_GAS_LIMIT`            | integer |         `500000`          | Gas limit for transactions         | .env         |
| `WEB3_GAS_PRICE_MULTIPLIER` | float   |           `1.1`           | Gas price multiplier (10% buffer)  | .env         |

**Configuration Example:**

```bash
# .env - Polygon Mainnet
WEB3_PROVIDER_URL=https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID
WEB3_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
WEB3_CHAIN_ID=137
WEB3_GAS_LIMIT=500000
WEB3_GAS_PRICE_MULTIPLIER=1.1

# .env - Polygon Mumbai Testnet
WEB3_PROVIDER_URL=https://polygon-mumbai.infura.io/v3/YOUR_PROJECT_ID
WEB3_CHAIN_ID=80001
```

**Chain IDs:**

| Network          | Chain ID | Description                      |
| ---------------- | -------: | -------------------------------- |
| Ethereum Mainnet |        1 | Production Ethereum              |
| Polygon Mainnet  |      137 | Production Polygon (recommended) |
| Ethereum Goerli  |        5 | Ethereum testnet                 |
| Polygon Mumbai   |    80001 | Polygon testnet                  |

### Smart Contract Addresses

| Option                          | Type   |  Default   | Description                  | Where to set |
| ------------------------------- | ------ | :--------: | ---------------------------- | ------------ |
| `CARBON_TOKEN_CONTRACT_ADDRESS` | string | (required) | ERC-20 carbon token contract | .env         |
| `MARKETPLACE_CONTRACT_ADDRESS`  | string | (required) | Marketplace contract         | .env         |
| `REGISTRY_CONTRACT_ADDRESS`     | string | (optional) | Registry contract            | .env         |
| `ESCROW_CONTRACT_ADDRESS`       | string | (optional) | Escrow contract              | .env         |

**Configuration after deployment:**

```bash
# .env
CARBON_TOKEN_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
MARKETPLACE_CONTRACT_ADDRESS=0xabcdefabcdefabcdefabcdefabcdefabcdefabcd
```

## Security Configuration

### Password Policy

| Option                       | Type    | Default | Description               | Where to set |
| ---------------------------- | ------- | :-----: | ------------------------- | ------------ |
| `PASSWORD_MIN_LENGTH`        | integer |   `8`   | Minimum password length   | config.py    |
| `PASSWORD_REQUIRE_UPPERCASE` | boolean | `true`  | Require uppercase letter  | config.py    |
| `PASSWORD_REQUIRE_LOWERCASE` | boolean | `true`  | Require lowercase letter  | config.py    |
| `PASSWORD_REQUIRE_NUMBERS`   | boolean | `true`  | Require number            | config.py    |
| `PASSWORD_REQUIRE_SYMBOLS`   | boolean | `true`  | Require special character | config.py    |
| `BCRYPT_LOG_ROUNDS`          | integer |  `12`   | Bcrypt hashing rounds     | config.py    |

### Session and Cookie Settings

| Option                       | Type      | Default  | Description                         | Where to set |
| ---------------------------- | --------- | :------: | ----------------------------------- | ------------ |
| `SESSION_COOKIE_SECURE`      | boolean   |  `true`  | HTTPS-only cookies                  | config.py    |
| `SESSION_COOKIE_HTTPONLY`    | boolean   |  `true`  | HTTP-only (no JavaScript access)    | config.py    |
| `SESSION_COOKIE_SAMESITE`    | string    |  `Lax`   | SameSite policy (Lax, Strict, None) | config.py    |
| `PERMANENT_SESSION_LIFETIME` | timedelta | `1 hour` | Session lifetime                    | config.py    |

### CSRF Protection

| Option                | Type    | Default | Description                   | Where to set |
| --------------------- | ------- | :-----: | ----------------------------- | ------------ |
| `WTF_CSRF_ENABLED`    | boolean | `true`  | Enable CSRF protection        | config.py    |
| `WTF_CSRF_TIME_LIMIT` | integer | `3600`  | CSRF token lifetime (seconds) | config.py    |

## Feature Flags

Enable or disable platform features:

| Option                            | Type    | Default | Description                        | Where to set |
| --------------------------------- | ------- | :-----: | ---------------------------------- | ------------ |
| `FEATURE_BLOCKCHAIN_INTEGRATION`  | boolean | `true`  | Enable blockchain features         | .env         |
| `FEATURE_ADVANCED_ANALYTICS`      | boolean | `true`  | Enable analytics dashboard         | .env         |
| `FEATURE_AUTOMATED_COMPLIANCE`    | boolean | `true`  | Enable automated compliance checks | .env         |
| `FEATURE_REAL_TIME_NOTIFICATIONS` | boolean | `true`  | Enable WebSocket notifications     | .env         |

**Example Configuration:**

```bash
# .env
FEATURE_BLOCKCHAIN_INTEGRATION=true
FEATURE_ADVANCED_ANALYTICS=true
FEATURE_AUTOMATED_COMPLIANCE=true
FEATURE_REAL_TIME_NOTIFICATIONS=true
```

## Email and Notifications

### Email Configuration (SMTP)

| Option                | Type    |           Default           | Description                  | Where to set |
| --------------------- | ------- | :-------------------------: | ---------------------------- | ------------ |
| `MAIL_SERVER`         | string  |         `localhost`         | SMTP server hostname         | .env         |
| `MAIL_PORT`           | integer |            `587`            | SMTP port (587=TLS, 465=SSL) | .env         |
| `MAIL_USE_TLS`        | boolean |           `true`            | Use TLS encryption           | .env         |
| `MAIL_USE_SSL`        | boolean |           `false`           | Use SSL encryption           | .env         |
| `MAIL_USERNAME`       | string  |              -              | SMTP username                | .env         |
| `MAIL_PASSWORD`       | string  |              -              | SMTP password                | .env         |
| `MAIL_DEFAULT_SENDER` | string  | `noreply@carbonxchange.com` | Default sender email         | .env         |

**Gmail Configuration Example:**

```bash
# .env
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USE_SSL=false
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=noreply@carbonxchange.com
```

**SendGrid Configuration Example:**

```bash
# .env
MAIL_SERVER=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=apikey
MAIL_PASSWORD=SG.your-sendgrid-api-key
SENDGRID_API_KEY=SG.your-sendgrid-api-key
```

### SMS Configuration (Twilio)

| Option                | Type   | Default | Description         | Where to set |
| --------------------- | ------ | :-----: | ------------------- | ------------ |
| `TWILIO_ACCOUNT_SID`  | string |    -    | Twilio account SID  | .env         |
| `TWILIO_AUTH_TOKEN`   | string |    -    | Twilio auth token   | .env         |
| `TWILIO_PHONE_NUMBER` | string |    -    | Twilio phone number | .env         |

```bash
# .env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

## External Services

### Error Tracking (Sentry)

| Option       | Type   | Default | Description        | Where to set |
| ------------ | ------ | :-----: | ------------------ | ------------ |
| `SENTRY_DSN` | string |    -    | Sentry project DSN | .env         |

```bash
# .env
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

### Monitoring

| Option                           | Type    | Default | Description                   | Where to set |
| -------------------------------- | ------- | :-----: | ----------------------------- | ------------ |
| `PROMETHEUS_METRICS_ENABLED`     | boolean | `true`  | Enable Prometheus metrics     | config.py    |
| `HEALTH_CHECK_ENABLED`           | boolean | `true`  | Enable health check endpoint  | config.py    |
| `PERFORMANCE_MONITORING_ENABLED` | boolean | `true`  | Enable performance monitoring | config.py    |

## Trading Configuration

| Option                        | Type    |  Default  | Description                           | Where to set |
| ----------------------------- | ------- | :-------: | ------------------------------------- | ------------ |
| `TRADING_ENABLED`             | boolean |  `true`   | Enable trading functionality          | config.py    |
| `TRADING_HOURS_START`         | integer |    `9`    | Trading start hour (24h format)       | config.py    |
| `TRADING_HOURS_END`           | integer |   `17`    | Trading end hour (24h format)         | config.py    |
| `TRADING_WEEKENDS_ENABLED`    | boolean |  `false`  | Allow weekend trading                 | config.py    |
| `ORDER_EXPIRY_HOURS`          | integer |   `24`    | Default order expiry (hours)          | config.py    |
| `MAX_ORDER_SIZE`              | integer | `1000000` | Maximum order size (tCO2e)            | config.py    |
| `MIN_ORDER_SIZE`              | integer |    `1`    | Minimum order size (tCO2e)            | config.py    |
| `MARKET_DATA_UPDATE_INTERVAL` | integer |   `60`    | Market data update interval (seconds) | .env         |

## Compliance Configuration

| Option                          | Type    | Default | Description                      | Where to set |
| ------------------------------- | ------- | :-----: | -------------------------------- | ------------ |
| `KYC_VERIFICATION_REQUIRED`     | boolean | `true`  | Require KYC for trading          | config.py    |
| `KYC_DOCUMENT_RETENTION_DAYS`   | integer | `2555`  | KYC document retention (7 years) | config.py    |
| `AML_SCREENING_ENABLED`         | boolean | `true`  | Enable AML screening             | config.py    |
| `AML_RISK_THRESHOLD`            | float   |  `0.7`  | AML risk threshold (0-1)         | .env         |
| `COMPLIANCE_MONITORING_ENABLED` | boolean | `true`  | Enable compliance monitoring     | config.py    |
| `DATA_RETENTION_DAYS`           | integer | `2555`  | Data retention period (days)     | .env         |

## File Upload Configuration

| Option               | Type    |   Default   | Description             | Where to set |
| -------------------- | ------- | :---------: | ----------------------- | ------------ |
| `UPLOAD_FOLDER`      | string  | `./uploads` | Upload directory path   | .env         |
| `MAX_CONTENT_LENGTH` | integer | `16777216`  | Max file size (16MB)    | config.py    |
| `ALLOWED_EXTENSIONS` | set     | (see below) | Allowed file extensions | config.py    |

**Allowed extensions:**

```python
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'txt'}
```

## Logging Configuration

| Option              | Type    |       Default       | Description                | Where to set |
| ------------------- | ------- | :-----------------: | -------------------------- | ------------ |
| `LOG_LEVEL`         | string  |       `INFO`        | Log level                  | .env         |
| `LOG_FILE`          | string  | `carbonxchange.log` | Log file name              | .env         |
| `LOG_MAX_BYTES`     | integer |     `10485760`      | Max log file size (10MB)   | config.py    |
| `LOG_BACKUP_COUNT`  | integer |         `5`         | Number of backup log files | config.py    |
| `AUDIT_LOG_ENABLED` | boolean |       `true`        | Enable audit logging       | config.py    |
| `AUDIT_LOG_FILE`    | string  |     `audit.log`     | Audit log file name        | .env         |

## Production Configuration Checklist

Before deploying to production, ensure:

- [ ] Change `SECRET_KEY` and `JWT_SECRET_KEY` to secure random values
- [ ] Set `FLASK_ENV=production`
- [ ] Use PostgreSQL instead of SQLite
- [ ] Configure Redis for caching and rate limiting
- [ ] Set appropriate `CORS_ORIGINS` (not `*`)
- [ ] Enable HTTPS and set `SESSION_COOKIE_SECURE=true`
- [ ] Configure real SMTP server for email
- [ ] Set up Sentry for error tracking
- [ ] Configure Web3 provider with production endpoints
- [ ] Deploy smart contracts to mainnet
- [ ] Enable all security features (CSRF, rate limiting)
- [ ] Set strong password policy
- [ ] Configure backups for database
- [ ] Set up monitoring and alerting
- [ ] Review and adjust rate limits
- [ ] Enable audit logging
- [ ] Configure data retention policies

## Environment-Specific Configurations

### Development

```bash
# .env.development
FLASK_ENV=development
DEBUG=true
LOG_LEVEL=DEBUG
DATABASE_URL=sqlite:///./database/dev.db
CORS_ORIGINS=*
FEATURE_BLOCKCHAIN_INTEGRATION=false
```

### Staging

```bash
# .env.staging
FLASK_ENV=production
DEBUG=false
LOG_LEVEL=INFO
DATABASE_URL=postgresql://user:pass@staging-db:5432/carbonxchange
CORS_ORIGINS=https://staging.carbonxchange.com
FEATURE_BLOCKCHAIN_INTEGRATION=true
WEB3_CHAIN_ID=80001  # Mumbai testnet
```

### Production

```bash
# .env.production
FLASK_ENV=production
DEBUG=false
LOG_LEVEL=WARNING
DATABASE_URL=postgresql://user:pass@prod-db:5432/carbonxchange
CORS_ORIGINS=https://app.carbonxchange.com
FEATURE_BLOCKCHAIN_INTEGRATION=true
WEB3_CHAIN_ID=137  # Polygon mainnet
SENTRY_DSN=https://xxx@sentry.io/xxx
```

## Next Steps

- Review [Installation Guide](INSTALLATION.md) for setup instructions
- See [API Reference](API.md) for endpoint configuration
- Check [Troubleshooting](TROUBLESHOOTING.md) for configuration issues
- Read [Security Best Practices](#) for hardening guidance
