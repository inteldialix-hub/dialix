#!/bin/bash

# Dialix Production Deployment Script
# This script sets up a production environment with PostgreSQL, security logging, and monitoring

set -e

echo "🚀 Starting Dialix Production Deployment"

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root"
   exit 1
fi

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/ai"
LOG_DIR="$BACKEND_DIR/logs"
SECURITY_LOG_DIR="$LOG_DIR/security"

# Create log directories
echo "📁 Creating log directories..."
mkdir -p "$LOG_DIR"
mkdir -p "$SECURITY_LOG_DIR"

# Set proper permissions
chmod 755 "$LOG_DIR"
chmod 700 "$SECURITY_LOG_DIR"

echo "✅ Log directories created"

# Check for required environment variables
echo "🔍 Checking environment configuration..."

REQUIRED_VARS=("JWT_SECRET" "ELEVENLABS_API_KEY" "FRONTEND_URL" "BACKEND_URL")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
        MISSING_VARS+=("$var")
    fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
    echo "❌ Missing required environment variables:"
    printf '   - %s\n' "${MISSING_VARS[@]}"
    echo ""
    echo "Please set these in your environment or .env.production file"
    exit 1
fi

echo "✅ Environment configuration looks good"

# Database setup (PostgreSQL)
if [[ "${DB_PROVIDER:-sqlite}" == "postgres" ]]; then
    echo "🗄️  Setting up PostgreSQL database..."

    # Check if PostgreSQL environment variables are set
    PG_VARS=("PG_HOST" "PG_USER" "PG_PASSWORD" "PG_DATABASE")
    MISSING_PG_VARS=()

    for var in "${PG_VARS[@]}"; do
        if [[ -z "${!var}" ]]; then
            MISSING_PG_VARS+=("$var")
        fi
    done

    if [[ ${#MISSING_PG_VARS[@]} -gt 0 ]]; then
        echo "❌ Missing PostgreSQL environment variables:"
        printf '   - %s\n' "${MISSING_PG_VARS[@]}"
        echo ""
        echo "Please configure your PostgreSQL connection"
        exit 1
    fi

    echo "✅ PostgreSQL configuration found"
else
    echo "📁 Using SQLite database (development mode)"
fi

# Install dependencies
echo "📦 Installing backend dependencies..."
cd "$BACKEND_DIR"
npm ci --production=false

echo "📦 Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm ci --production=false

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Create production .env file if it doesn't exist
if [[ ! -f "$BACKEND_DIR/.env.production" ]]; then
    echo "📝 Creating production environment template..."
    cat > "$BACKEND_DIR/.env.production" << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3001

# Database Configuration
DB_PROVIDER=postgres
PG_HOST=your-postgres-host.rds.amazonaws.com
PG_PORT=5432
PG_USER=dialix_admin
PG_PASSWORD=your-secure-database-password
PG_DATABASE=dialix_prod

# Application Security
JWT_SECRET=${JWT_SECRET}
BCRYPT_ROUNDS=12

# External Services
ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}

# CORS and URLs
FRONTEND_URL=${FRONTEND_URL}
BACKEND_URL=${BACKEND_URL}

# Security Headers
HSTS_MAX_AGE=31536000
HSTS_INCLUDE_SUBDOMAINS=true

# Rate Limiting
LOGIN_MAX_ATTEMPTS=5
LOGIN_WINDOW_MS=900000
REGISTER_MAX_ATTEMPTS=3
REGISTER_WINDOW_MS=3600000

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/dialix/app.log
SECURITY_LOG_FILE=/var/log/dialix/security.log

# Monitoring (optional)
SENTRY_DSN=your-sentry-dsn-for-error-tracking
EOF
    echo "✅ Production environment template created at $BACKEND_DIR/.env.production"
    echo "⚠️  Please review and update the configuration values"
fi

# Create systemd service file for production deployment
if [[ -d "/etc/systemd/system" ]]; then
    echo "🔧 Creating systemd service..."

    cat > "/tmp/dialix-backend.service" << EOF
[Unit]
Description=Dialix Backend Service
After=network.target
Wants=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$BACKEND_DIR
Environment=NODE_ENV=production
EnvironmentFile=$BACKEND_DIR/.env.production
ExecStart=/usr/bin/node $BACKEND_DIR/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=dialix-backend

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=$LOG_DIR
ProtectHome=yes

[Install]
WantedBy=multi-user.target
EOF

    sudo mv "/tmp/dialix-backend.service" "/etc/systemd/system/"
    sudo systemctl daemon-reload

    echo "✅ Systemd service created"
    echo "   Start with: sudo systemctl start dialix-backend"
    echo "   Enable on boot: sudo systemctl enable dialix-backend"
fi

# Create log rotation configuration
if [[ -d "/etc/logrotate.d" ]]; then
    echo "🔄 Setting up log rotation..."

    cat > "/tmp/dialix" << EOF
$LOG_DIR/*.log $SECURITY_LOG_DIR/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $USER $USER
    postrotate
        systemctl reload dialix-backend || true
    endscript
}
EOF

    sudo mv "/tmp/dialix" "/etc/logrotate.d/"
    echo "✅ Log rotation configured"
fi

# Security audit
echo "🔒 Running security audit..."
cd "$BACKEND_DIR"
npm audit --audit-level moderate

cd "$FRONTEND_DIR"
npm audit --audit-level moderate

echo ""
echo "🎉 Production deployment setup complete!"
echo ""
echo "Next steps:"
echo "1. Review and update $BACKEND_DIR/.env.production"
echo "2. Configure your PostgreSQL database (if using)"
echo "3. Set up SSL/TLS certificates for HTTPS"
echo "4. Configure a reverse proxy (nginx recommended)"
echo "5. Start the service: sudo systemctl start dialix-backend"
echo "6. Monitor logs: tail -f $LOG_DIR/app.log"
echo "7. Check security logs: tail -f $SECURITY_LOG_DIR/security.log"
echo ""
echo "For monitoring and alerting, consider:"
echo "- Setting up CloudWatch alarms (AWS)"
echo "- Configuring Sentry for error tracking"
echo "- Setting up log aggregation (ELK stack)"
echo ""
echo "Security checklist:"
echo "- [ ] HTTPS/TLS configured"
echo "- [ ] Database backups scheduled"
echo "- [ ] Monitoring alerts set up"
echo "- [ ] Log retention policy configured"
echo "- [ ] Regular security updates scheduled"