# Troubleshooting Guide

Common issues and solutions for CarbonXchange platform.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Database Issues](#database-issues)
- [API Issues](#api-issues)
- [Blockchain Issues](#blockchain-issues)
- [Authentication Issues](#authentication-issues)
- [Trading Issues](#trading-issues)
- [Performance Issues](#performance-issues)

## Installation Issues

### Problem: Python dependencies fail to install

**Symptoms**: `pip install -r requirements.txt` fails with compilation errors

**Solutions**:

1. Update pip and setuptools:

```bash
pip install --upgrade pip setuptools wheel
```

2. Install system dependencies (Ubuntu/Debian):

```bash
sudo apt-get install python3-dev postgresql-server-dev-all libpq-dev
```

3. Install system dependencies (macOS):

```bash
brew install postgresql openssl
```

4. Use virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Problem: Node.js dependencies fail

**Symptoms**: `npm install` fails or warns about vulnerabilities

**Solutions**:

1. Clear npm cache:

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

2. Use correct Node.js version (v14+):

```bash
nvm use 14  # or nvm use 16
npm install
```

3. Fix vulnerabilities:

```bash
npm audit fix
```

### Problem: Database connection fails

**Symptoms**: `FATAL: database "carbonxchange" does not exist`

**Solutions**:

1. Create database:

```bash
sudo -u postgres createdb carbonxchange
```

2. Check PostgreSQL is running:

```bash
sudo systemctl status postgresql
sudo systemctl start postgresql
```

3. Verify connection string in `.env`:

```bash
DATABASE_URL=postgresql://username:password@localhost:5432/carbonxchange
```

## Database Issues

### Problem: Migration fails

**Symptoms**: `flask db upgrade` fails with errors

**Solutions**:

1. Check current migration version:

```bash
flask db current
```

2. Reset migrations (development only):

```bash
flask db downgrade base
flask db upgrade
```

3. Generate new migration:

```bash
flask db migrate -m "description"
flask db upgrade
```

4. Drop and recreate database (CAUTION: loses data):

```bash
dropdb carbonxchange
createdb carbonxchange
flask db upgrade
```

### Problem: Connection pool exhausted

**Symptoms**: "Too many connections" error

**Solutions**:

1. Increase pool size in `config.py`:

```python
SQLALCHEMY_POOL_SIZE = 50
SQLALCHEMY_MAX_OVERFLOW = 20
```

2. Enable connection recycling:

```python
SQLALCHEMY_POOL_RECYCLE = 300  # seconds
```

3. Check for connection leaks in code

## API Issues

### Problem: 401 Unauthorized errors

**Symptoms**: All API requests return 401

**Solutions**:

1. Check token expiration (access tokens expire in 15 minutes)
2. Refresh token:

```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "YOUR_REFRESH_TOKEN"}'
```

3. Re-login if refresh token expired

4. Verify Authorization header format:

```
Authorization: Bearer <token>
```

### Problem: 429 Rate Limit Exceeded

**Symptoms**: "Too many requests" error

**Solutions**:

1. Wait for rate limit window to reset (check `X-RateLimit-Reset` header)
2. Reduce request frequency
3. For testing, disable rate limiting:

```python
# config.py (development only)
RATELIMIT_ENABLED = False
```

### Problem: CORS errors in browser

**Symptoms**: "Access-Control-Allow-Origin" error

**Solutions**:

1. Configure CORS origins in `.env`:

```bash
CORS_ORIGINS=http://localhost:3000,https://app.carbonxchange.com
```

2. For development, allow all origins (not recommended for production):

```bash
CORS_ORIGINS=*
```

3. Check browser console for actual error

## Blockchain Issues

### Problem: Smart contract deployment fails

**Symptoms**: "insufficient funds" or "nonce too low"

**Solutions**:

1. Ensure wallet has sufficient balance for gas
2. Get testnet tokens from faucet (Polygon Amoy):
   - https://faucet.polygon.technology/

3. Reset nonce in MetaMask:
   - Settings → Advanced → Reset Account

4. Verify network configuration in `truffle-config.js`

### Problem: Transaction fails with "gas required exceeds allowance"

**Solutions**:

1. Increase gas limit in `.env`:

```bash
WEB3_GAS_LIMIT=1000000
```

2. Check contract for infinite loops or expensive operations

3. Use gas estimation:

```javascript
const gasEstimate = await contract.methods.mint(...).estimateGas();
```

### Problem: Cannot connect to Web3 provider

**Symptoms**: "Could not connect to provider"

**Solutions**:

1. Verify Infura/Alchemy API key is correct
2. Check network status: https://status.infura.io/
3. Test provider URL:

```bash
curl -X POST YOUR_PROVIDER_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## Authentication Issues

### Problem: MFA code not accepted

**Solutions**:

1. Ensure device time is synchronized
2. Use time-based codes (not counter-based)
3. Regenerate QR code if necessary
4. Check authenticator app is correct (Google Authenticator, Authy, etc.)

### Problem: Password reset email not received

**Solutions**:

1. Check spam/junk folder
2. Verify email configuration in `.env`:

```bash
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

3. Check email logs:

```bash
tail -f carbonxchange.log | grep "email"
```

4. Test SMTP connection:

```bash
python -c "import smtplib; smtplib.SMTP('smtp.gmail.com', 587).connect()"
```

## Trading Issues

### Problem: Order not executing

**Solutions**:

1. Check order status:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/trading/orders/{order_id}
```

2. Verify sufficient portfolio balance for buy orders
3. Check if market is open (trading hours configuration)
4. Review risk checks and compliance status

### Problem: Portfolio calculation incorrect

**Solutions**:

1. Trigger portfolio recalculation:

```python
from services.portfolio_service import PortfolioService
PortfolioService().recalculate_portfolio(user_id)
```

2. Check for orphaned trades or orders
3. Review audit logs for discrepancies

## Performance Issues

### Problem: Slow API response times

**Solutions**:

1. Enable Redis caching (if not already):

```bash
REDIS_URL=redis://localhost:6379/0
```

2. Add database indexes:

```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_trades_executed_at ON trades(executed_at);
```

3. Enable query logging to identify slow queries:

```python
SQLALCHEMY_RECORD_QUERIES = True
SQLALCHEMY_SLOW_QUERY_THRESHOLD = 0.5  # seconds
```

4. Use connection pooling
5. Scale horizontally with load balancer

### Problem: High memory usage

**Solutions**:

1. Reduce connection pool size
2. Implement pagination for large result sets
3. Use database cursors for large queries
4. Monitor with:

```bash
ps aux | grep python
htop
```

## Getting More Help

If issues persist:

1. Check logs: `tail -f carbonxchange.log`
2. Enable debug mode (development only): `DEBUG=true`
3. Search GitHub Issues: https://github.com/quantsingularity/CarbonXchange/issues
4. Create new issue with:
   - Environment details (OS, Python/Node version)
   - Error messages and stack traces
   - Steps to reproduce
   - Configuration (sanitize secrets)

## Common Error Codes

| Code | Meaning               | Common Cause             | Solution                                   |
| ---- | --------------------- | ------------------------ | ------------------------------------------ |
| 400  | Bad Request           | Invalid input            | Check request format and required fields   |
| 401  | Unauthorized          | Missing/invalid token    | Login or refresh token                     |
| 403  | Forbidden             | Insufficient permissions | Check user role and KYC status             |
| 404  | Not Found             | Resource doesn't exist   | Verify resource ID                         |
| 429  | Too Many Requests     | Rate limit exceeded      | Wait or reduce request frequency           |
| 500  | Internal Server Error | Server-side bug          | Check logs, report issue                   |
| 503  | Service Unavailable   | Dependency down          | Check database, Redis, blockchain provider |
