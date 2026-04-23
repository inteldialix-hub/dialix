#!/bin/bash

# Dialix Hosting Cost Calculator
# Helps estimate monthly costs for different hosting configurations

echo "🚀 Dialix Hosting Cost Calculator"
echo "=================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display cost breakdown
show_cost_breakdown() {
    local provider="$1"
    local frontend_cost="$2"
    local backend_cost="$3"
    local database_cost="$4"
    local total_cost="$5"
    local notes="$6"

    echo -e "${BLUE}$provider${NC}"
    echo "  Frontend: \$$frontend_cost/month"
    echo "  Backend:  \$$backend_cost/month"
    echo "  Database: \$$database_cost/month"
    echo -e "  ${GREEN}Total: \$$total_cost/month${NC}"
    if [ -n "$notes" ]; then
        echo -e "  ${YELLOW}Notes: $notes${NC}"
    fi
    echo ""
}

echo "Recommended Production Configurations:"
echo "======================================"
echo ""

show_cost_breakdown "Railway + Vercel ⭐⭐⭐⭐⭐" "20" "10" "0" "30" "Best for Node.js + Next.js, excellent developer experience"
show_cost_breakdown "DigitalOcean + Vercel" "20" "12" "15" "47" "Good balance of cost and control"
show_cost_breakdown "Render + Netlify" "19" "19" "25" "63" "Simple deployment, good free tier"
show_cost_breakdown "AWS Stack" "15" "25" "25" "65" "Maximum control and scalability"

echo "Development/Hobby Configurations:"
echo "=================================="
echo ""

show_cost_breakdown "Railway Hobby + Vercel" "0" "5" "0" "5" "Perfect for development and testing"
show_cost_breakdown "Render Free + Netlify" "0" "0" "7" "7" "Free tier with limitations"

echo "Additional Costs to Consider:"
echo "=============================="
echo "• Custom Domain: \$10-20/year"
echo "• SSL Certificate: Usually included"
echo "• Monitoring: \$10-50/month (optional)"
echo "• ElevenLabs API: \$5-99/month (based on usage)"
echo "• Bandwidth overages: Variable"
echo ""

echo "Recommended Setup: Railway + Vercel"
echo "==================================="
echo "Monthly Cost: \$30"
echo "Setup Time: 30 minutes"
echo "Pros:"
echo "  ✅ Easiest deployment process"
echo "  ✅ Excellent Next.js support"
echo "  ✅ Built-in WebSocket support"
echo "  ✅ Automatic scaling"
echo "  ✅ PostgreSQL included"
echo "  ✅ Great for real-time applications"
echo ""

echo "Quick Deployment Checklist:"
echo "==========================="
echo "1. Create Railway account (https://railway.app)"
echo "2. Create Vercel account (https://vercel.com)"
echo "3. Connect GitHub repositories"
echo "4. Set environment variables:"
echo "   - JWT_SECRET (generate secure random string)"
echo "   - DATABASE_URL (from Railway)"
echo "   - FRONTEND_URL (from Vercel)"
echo "   - ELEVENLABS_API_KEY (from ElevenLabs)"
echo "5. Deploy backend first, then frontend"
echo "6. Test WebSocket connections"
echo "7. Set up monitoring (optional)"
echo ""

echo "Environment Variables Template:"
echo "==============================="
echo "# Backend (.env)"
echo "JWT_SECRET=your-super-secure-random-string-here"
echo "DB_PROVIDER=postgres"
echo "DATABASE_URL=postgresql://user:password@host:5432/database"
echo "FRONTEND_URL=https://your-app.vercel.app"
echo "ELEVENLABS_API_KEY=your-elevenlabs-api-key"
echo "PORT=3001"
echo ""
echo "# Frontend (Vercel Environment Variables)"
echo "NEXT_PUBLIC_API_URL=https://your-backend.railway.app"
echo ""

echo -e "${GREEN}Ready to deploy? Run the setup commands above!${NC}"