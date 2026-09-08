# ExpenseIQ Backend — Production Deployment Guide

This guide provides step-by-step instructions for deploying the ExpenseIQ backend to production in a secure, scalable, and provider-agnostic environment.

---

## 1. System & Runtime Requirements

- **Node.js**: v20 LTS or v22 LTS
- **PostgreSQL**: v14, v15, or v16
- **OS**: Linux (Ubuntu 22.04 LTS recommended) / Docker container runner
- **Memory**: Minimum 512MB RAM (1GB+ recommended)

---

## 2. Environment Variable Configuration

Create the production `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Configure required production settings:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL="postgresql://user:password@db-host:5432/expenseiq_prod?schema=public&sslmode=require"
JWT_ACCESS_SECRET="GENERATE_STRONG_HIGH_ENTROPY_SECRET_KEY"
CORS_ORIGIN="https://app.expenseiq.com"
CRON_RECURRING_ENABLED=true
CRON_RECURRING_SCHEDULE="0 0 * * *"
```

> **Security Alert**: Generate `JWT_ACCESS_SECRET` using `openssl rand -hex 32`.

---

## 3. Database Migration Workflow

In production environments, **never** execute `prisma db push`. Always use standard Prisma migration deployment:

```bash
# 1. Install production dependencies
npm ci --only=production

# 2. Generate Prisma Client
npx prisma generate

# 3. Apply all pending database migrations safely
npx prisma migrate deploy
```

---

## 4. Application Build & Execution

Compile TypeScript and launch server process:

```bash
# Compile TypeScript to dist/
npm run build

# Start production server
npm start
```

For process supervision (PM2 / Systemd), run:

```bash
# Example with PM2
pm2 start dist/server.js --name "expenseiq-backend" -i max
```

---

## 5. Reverse Proxy & SSL Termination (Nginx)

Configure Nginx as reverse proxy with SSL:

```nginx
server {
    listen 443 ssl http2;
    server_name api.expenseiq.com;

    ssl_certificate /etc/letsencrypt/live/api.expenseiq.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.expenseiq.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 6. Health & Post-Deployment Verification

Verify operational probes:

```bash
# 1. Liveness check
curl -f https://api.expenseiq.com/health/live

# 2. Database readiness check
curl -f https://api.expenseiq.com/health/ready
```

Expected response for readiness:
```json
{
  "success": true,
  "message": "Application is ready to process requests",
  "data": {
    "status": "ok",
    "database": "connected"
  }
}
```

---

## 7. Graceful Shutdown & Maintenance

When deploying new code or restarting services, PM2/Docker sends `SIGTERM`. The backend gracefully drains HTTP connections, completes active transactions, stops scheduled cron jobs, and disconnects Prisma cleanly within 10 seconds.
