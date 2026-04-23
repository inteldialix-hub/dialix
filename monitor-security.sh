#!/bin/bash

# Dialix Security Monitoring Script
# Monitors logs for security events and system health

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/backend/logs"
SECURITY_LOG="$LOG_DIR/security.log"
APP_LOG="$LOG_DIR/app.log"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Configuration
ALERT_EMAIL="${ALERT_EMAIL:-admin@yourdomain.com}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
CHECK_INTERVAL="${CHECK_INTERVAL:-300}" # 5 minutes default

# Function to send alerts
send_alert() {
    local severity="$1"
    local message="$2"
    local details="$3"

    echo -e "${RED}🚨 ALERT [$severity]: $message${NC}"
    echo "Details: $details"

    # Email alert (if mail is available)
    if command -v mail &> /dev/null && [[ -n "$ALERT_EMAIL" ]]; then
        echo "$details" | mail -s "Dialix Security Alert: $message" "$ALERT_EMAIL"
    fi

    # Slack alert (if webhook is configured)
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Dialix Security Alert [$severity]: $message\n$details\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
}

# Function to check security logs for critical events
check_security_events() {
    local since_file="$LOG_DIR/.last_check"
    local last_check="1 hour ago"

    if [[ -f "$since_file" ]]; then
        last_check=$(cat "$since_file")
    fi

    # Check for critical security events in the last hour
    local critical_events=$(jq -r 'select(.level == "error" and (.event | test("suspicious_activity|db_connection_error|backup_failed"))) | "\(.timestamp) \(.event) \(.data)"' "$SECURITY_LOG" 2>/dev/null | tail -n 20)

    if [[ -n "$critical_events" ]]; then
        send_alert "CRITICAL" "Security Events Detected" "$critical_events"
    fi

    # Check for authentication failures (brute force attempts)
    local auth_failures=$(jq -r 'select(.event == "auth_failure") | .data.email' "$SECURITY_LOG" 2>/dev/null | sort | uniq -c | sort -nr | head -5)

    echo "$auth_failures" | while read -r count email; do
        if [[ $count -gt 10 ]]; then
            send_alert "WARNING" "Potential Brute Force Attack" "Email: $email, Failures: $count in last hour"
        fi
    done

    # Update last check timestamp
    date +%s > "$since_file"
}

# Function to check system health
check_system_health() {
    # Check if backend is running
    if ! pgrep -f "node.*server.js" > /dev/null; then
        send_alert "CRITICAL" "Backend Service Down" "Dialix backend service is not running"
        return
    fi

    # Check database connectivity (if PostgreSQL)
    if [[ "${DB_PROVIDER:-sqlite}" == "postgres" ]]; then
        if ! PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DATABASE" -c "SELECT 1;" &>/dev/null; then
            send_alert "CRITICAL" "Database Connection Failed" "Cannot connect to PostgreSQL database"
        fi
    fi

    # Check disk space
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [[ $disk_usage -gt 90 ]]; then
        send_alert "WARNING" "Low Disk Space" "Disk usage is at ${disk_usage}%"
    fi

    # Check log file sizes
    local log_size=$(stat -f%z "$APP_LOG" 2>/dev/null || stat -c%s "$APP_LOG" 2>/dev/null || echo "0")
    if [[ $log_size -gt 1073741824 ]]; then # 1GB
        send_alert "INFO" "Large Log File" "Application log is over 1GB"
    fi
}

# Function to generate security report
generate_report() {
    local report_file="$LOG_DIR/security_report_$(date +%Y%m%d_%H%M%S).txt"

    {
        echo "Dialix Security Report - $(date)"
        echo "=================================="
        echo ""

        echo "Authentication Summary (Last 24h):"
        echo "-----------------------------------"
        jq -r 'select(.timestamp > (now - 86400 | tostring) and (.event | test("auth_success|auth_failure"))) | .event' "$SECURITY_LOG" 2>/dev/null | sort | uniq -c || echo "No auth events found"

        echo ""
        echo "Top Failed Login Attempts:"
        echo "---------------------------"
        jq -r 'select(.event == "auth_failure") | .data.email' "$SECURITY_LOG" 2>/dev/null | sort | uniq -c | sort -nr | head -10 || echo "No failed logins"

        echo ""
        echo "Admin Actions (Last 24h):"
        echo "--------------------------"
        jq -r 'select(.timestamp > (now - 86400 | tostring) and (.event | test("admin_"))) | "\(.timestamp) \(.data.email) \(.event)"' "$SECURITY_LOG" 2>/dev/null | head -20 || echo "No admin actions"

        echo ""
        echo "Security Events Summary:"
        echo "------------------------"
        jq -r '.event' "$SECURITY_LOG" 2>/dev/null | sort | uniq -c | sort -nr || echo "No security events"

        echo ""
        echo "System Health:"
        echo "--------------"
        echo "Backend Status: $(pgrep -f 'node.*server.js' > /dev/null && echo 'Running' || echo 'Stopped')"
        echo "Disk Usage: $(df / | tail -1 | awk '{print $5}')"
        echo "Log Size: $(ls -lh "$APP_LOG" | awk '{print $5}' 2>/dev/null || echo 'N/A')"

    } > "$report_file"

    echo -e "${GREEN}📊 Security report generated: $report_file${NC}"
}

# Function to rotate logs if needed
rotate_logs() {
    local max_size=104857600 # 100MB

    for log_file in "$APP_LOG" "$SECURITY_LOG"; do
        if [[ -f "$log_file" ]]; then
            local size=$(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null || echo "0")
            if [[ $size -gt $max_size ]]; then
                local backup="${log_file}.$(date +%Y%m%d_%H%M%S).bak"
                mv "$log_file" "$backup"
                echo -e "${YELLOW}🔄 Rotated log file: $backup${NC}"
                gzip "$backup" &
            fi
        fi
    done
}

# Main monitoring loop
main() {
    echo -e "${GREEN}🔍 Starting Dialix Security Monitor${NC}"
    echo "Monitoring interval: ${CHECK_INTERVAL} seconds"
    echo "Logs: $APP_LOG, $SECURITY_LOG"
    echo ""

    while true; do
        echo "$(date): Running security checks..."

        # Run all checks
        check_security_events
        check_system_health
        rotate_logs

        # Generate daily report at midnight
        if [[ $(date +%H%M) == "0000" ]]; then
            generate_report
        fi

        echo -e "${GREEN}✅ Security checks completed${NC}"
        sleep "$CHECK_INTERVAL"
    done
}

# Handle command line arguments
case "${1:-}" in
    "check")
        echo "Running one-time security check..."
        check_security_events
        check_system_health
        echo "Check completed."
        ;;
    "report")
        generate_report
        ;;
    "rotate")
        rotate_logs
        ;;
    *)
        main
        ;;
esac