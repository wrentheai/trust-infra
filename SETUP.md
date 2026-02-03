# Trust Infrastructure Setup Guide

Complete setup instructions for development and production deployment.

## Development Setup

### 1. Prerequisites

Install required software:

```bash
# Node.js 20+ (use nvm for version management)
nvm install 20
nvm use 20

# PostgreSQL 16+
# macOS:
brew install postgresql@16
brew services start postgresql@16

# Ubuntu/Debian:
sudo apt install postgresql-16

# Docker (optional, for containerized setup)
brew install docker docker-compose
```

### 2. Clone and Install

```bash
# Clone repository
git clone https://github.com/your-org/trust-infra.git
cd trust-infra

# Install dependencies
npm install

# This installs all workspace packages:
# - @trust-infra/crypto
# - @trust-infra/client
# - @trust-infra/server
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your settings
nano .env
```

**Required settings:**
```bash
DATABASE_URL=postgresql://trust:your_password@localhost:5432/trust_infra
SERVICE_API_KEY=your-secret-key-min-32-chars
```

### 4. Database Setup

**Option A: Local PostgreSQL**

```bash
# Create database and user
psql postgres <<EOF
CREATE USER trust WITH PASSWORD 'your_password';
CREATE DATABASE trust_infra OWNER trust;
GRANT ALL PRIVILEGES ON DATABASE trust_infra TO trust;
EOF

# Run migrations
npm run migrate
```

**Option B: Docker PostgreSQL**

```bash
# Start PostgreSQL in Docker
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
sleep 5

# Run migrations
npm run migrate
```

### 5. Build and Start

```bash
# Build all packages
npm run build

# Start development server (with hot reload)
npm run dev:server

# Or start production server
npm start -w @trust-infra/server
```

The server will be running at `http://localhost:3000`.

### 6. Verify Installation

```bash
# Check health endpoint
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2026-02-03T10:00:00.000Z"}
```

### 7. Run Example

```bash
# Terminal 1: Keep server running
npm run dev:server

# Terminal 2: Run example
npx tsx examples/basic-usage.ts
```

## Production Deployment

### Docker Deployment (Recommended)

```bash
# 1. Set production environment variables
cat > .env <<EOF
NODE_ENV=production
DATABASE_URL=postgresql://trust:${DB_PASSWORD}@postgres:5432/trust_infra
DB_PASSWORD=$(openssl rand -base64 32)
SERVICE_API_KEY=$(openssl rand -base64 32)
LOG_LEVEL=info
EOF

# 2. Build and start services
docker-compose up -d

# 3. View logs
docker-compose logs -f

# 4. Check status
docker-compose ps

# 5. Run migrations (first time only)
docker-compose exec trust-service npm run migrate
```

### VPS Deployment (Ubuntu 22.04)

```bash
# 1. Install dependencies
sudo apt update
sudo apt install -y nodejs npm postgresql-16 nginx

# 2. Create app user
sudo useradd -m -s /bin/bash trust-infra
sudo su - trust-infra

# 3. Clone and setup
git clone https://github.com/your-org/trust-infra.git
cd trust-infra
npm ci --production
npm run build

# 4. Setup database
sudo -u postgres psql <<EOF
CREATE USER trust WITH PASSWORD 'strong-password';
CREATE DATABASE trust_infra OWNER trust;
EOF

# 5. Configure environment
cp .env.example .env
# Edit .env with production values

# 6. Run migrations
npm run migrate

# 7. Setup systemd service
sudo tee /etc/systemd/system/trust-infra.service <<EOF
[Unit]
Description=Trust Infrastructure Service
After=network.target postgresql.service

[Service]
Type=simple
User=trust-infra
WorkingDirectory=/home/trust-infra/trust-infra
EnvironmentFile=/home/trust-infra/trust-infra/.env
ExecStart=/usr/bin/node packages/server/dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 8. Start service
sudo systemctl daemon-reload
sudo systemctl enable trust-infra
sudo systemctl start trust-infra

# 9. Check status
sudo systemctl status trust-infra
```

### Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/trust-infra
server {
    listen 80;
    server_name trust.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/trust-infra /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d trust.yourdomain.com
```

## Cloud Deployment

### AWS EC2 + RDS

1. **Launch RDS PostgreSQL 16**
   - Instance class: db.t3.medium (or larger)
   - Enable automated backups
   - Set retention period: 7 days
   - Note the endpoint URL

2. **Launch EC2 instance**
   - AMI: Ubuntu 22.04 LTS
   - Instance type: t3.medium (or larger)
   - Security group: Allow 22 (SSH), 80 (HTTP), 443 (HTTPS)

3. **Deploy application**
   ```bash
   # SSH to EC2
   ssh -i your-key.pem ubuntu@ec2-ip

   # Follow VPS deployment steps above
   # Use RDS endpoint in DATABASE_URL
   ```

### Google Cloud Run

```bash
# 1. Build Docker image
docker build -t gcr.io/your-project/trust-infra:latest -f packages/server/Dockerfile .

# 2. Push to GCR
docker push gcr.io/your-project/trust-infra:latest

# 3. Deploy to Cloud Run
gcloud run deploy trust-infra \
  --image gcr.io/your-project/trust-infra:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=postgresql://..." \
  --set-env-vars "SERVICE_API_KEY=..."
```

### Kubernetes

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trust-infra
spec:
  replicas: 3
  selector:
    matchLabels:
      app: trust-infra
  template:
    metadata:
      labels:
        app: trust-infra
    spec:
      containers:
      - name: trust-infra
        image: your-registry/trust-infra:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: trust-infra-secrets
              key: database-url
        - name: SERVICE_API_KEY
          valueFrom:
            secretKeyRef:
              name: trust-infra-secrets
              key: service-api-key
```

```bash
# Deploy
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

## Monitoring

### Health Checks

```bash
# Basic health check
curl http://localhost:3000/health

# Database connectivity check
curl http://localhost:3000/api/agents

# Verify specific agent chain
curl -X POST http://localhost:3000/api/events/verify-chain \
  -H "Content-Type: application/json" \
  -d '{"agentId":"your-agent-id"}'
```

### Logs

```bash
# Docker
docker-compose logs -f trust-service

# Systemd
sudo journalctl -u trust-infra -f

# Direct
tail -f logs/trust-infra.log
```

### Metrics (Future)

Integration with Prometheus/Grafana coming in v1.2:
- Event append rate
- Verification duration
- Database query performance
- Error rates by endpoint

## Security Checklist

- [ ] Change `SERVICE_API_KEY` from default
- [ ] Use strong database password
- [ ] Enable HTTPS (SSL/TLS)
- [ ] Restrict database access (firewall)
- [ ] Enable database encryption at rest
- [ ] Set up automated backups
- [ ] Use encrypted keystores for agent keys
- [ ] Rotate service keys regularly (every 90 days)
- [ ] Monitor for suspicious activity
- [ ] Keep dependencies updated

## Backup and Recovery

### Database Backup

```bash
# Manual backup
pg_dump -h localhost -U trust trust_infra > backup-$(date +%Y%m%d).sql

# Restore
psql -h localhost -U trust trust_infra < backup-20260203.sql
```

### Automated Backups (cron)

```bash
# Add to crontab
0 2 * * * pg_dump -h localhost -U trust trust_infra | gzip > /backups/trust-infra-$(date +\%Y\%m\%d).sql.gz
```

### Docker Volume Backup

```bash
# Backup volume
docker run --rm -v trust-infra_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data

# Restore volume
docker run --rm -v trust-infra_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup.tar.gz -C /
```

## Troubleshooting

### Server won't start

```bash
# Check logs
npm run dev:server

# Common issues:
# 1. Port already in use
lsof -i :3000
kill -9 <PID>

# 2. Database connection failed
psql $DATABASE_URL  # Test connection

# 3. Migrations not run
npm run migrate
```

### Events not verifying

```bash
# Check agent status
curl http://localhost:3000/api/agents/your-agent-id

# Verify chain
curl -X POST http://localhost:3000/api/events/verify-chain \
  -H "Content-Type: application/json" \
  -d '{"agentId":"your-agent-id"}'

# Check database directly
psql $DATABASE_URL -c "SELECT COUNT(*) FROM events WHERE agent_id = 'your-agent-id';"
```

### High latency

```bash
# Check database indexes
psql $DATABASE_URL -c "\d+ events"

# Monitor queries
psql $DATABASE_URL -c "SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Scale vertically (more resources)
# Or horizontally (read replicas)
```

## Support

- Documentation: https://docs.trust-infra.dev
- Issues: https://github.com/your-org/trust-infra/issues
- Discord: https://discord.gg/trust-infra
- Email: support@trust-infra.dev

---

Ready to build trustworthy AI agents! 🚀
