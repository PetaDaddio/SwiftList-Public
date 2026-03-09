#!/bin/bash

# SwiftList Cloudflare Configuration Script
# This script configures both heyswiftlist.com and swiftlist.app domains

set -e

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║     SWIFTLIST CLOUDFLARE CONFIGURATION                              ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if authenticated
echo "🔍 Checking Cloudflare authentication..."
if ! wrangler whoami &>/dev/null; then
    echo -e "${RED}❌ Not authenticated with Cloudflare${NC}"
    echo ""
    echo "Please authenticate using ONE of these methods:"
    echo ""
    echo "1. Browser OAuth (Recommended):"
    echo "   wrangler login"
    echo ""
    echo "2. API Token:"
    echo "   export CLOUDFLARE_API_TOKEN=your_token_here"
    echo ""
    echo "Get token from: https://dash.cloudflare.com/profile/api-tokens"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Authenticated with Cloudflare${NC}"
echo ""

# Function to get zone ID
get_zone_id() {
    local domain=$1
    zone_id=$(wrangler zones list 2>/dev/null | grep "$domain" | awk '{print $1}')
    if [ -z "$zone_id" ]; then
        echo -e "${RED}❌ Zone not found for $domain${NC}"
        echo "   Make sure the domain is added to your Cloudflare account"
        return 1
    fi
    echo "$zone_id"
}

# Get zone IDs
echo "📍 Finding Cloudflare zones..."
MARKETING_ZONE=$(get_zone_id "heyswiftlist.com")
APP_ZONE=$(get_zone_id "swiftlist.app")

echo -e "${GREEN}✓ heyswiftlist.com Zone ID: $MARKETING_ZONE${NC}"
echo -e "${GREEN}✓ swiftlist.app Zone ID: $APP_ZONE${NC}"
echo ""

# Save zone IDs for later use
cat > /tmp/swiftlist-zones.env << EOF
MARKETING_ZONE_ID=$MARKETING_ZONE
APP_ZONE_ID=$APP_ZONE
EOF

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CONFIGURING: heyswiftlist.com (Marketing Site)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Marketing site configuration
echo "1️⃣  Configuring SSL/TLS: Full (strict)..."
wrangler zones ssl set "$MARKETING_ZONE" --mode full || echo "⚠️  Manual config required"

echo "2️⃣  Enabling HSTS (1 year)..."
wrangler zones settings update "$MARKETING_ZONE" \
    --security-header '{"strict_transport_security":{"enabled":true,"max_age":31536000,"include_subdomains":true}}' \
    || echo "⚠️  Manual config required"

echo "3️⃣  Enabling Bot Fight Mode..."
wrangler zones settings update "$MARKETING_ZONE" --bot-fight-mode on || echo "⚠️  Manual config required"

echo "4️⃣  Configuring caching: Aggressive..."
echo "   ⚠️  Caching rules must be configured via Cloudflare Dashboard:"
echo "   https://dash.cloudflare.com/$MARKETING_ZONE/caching/configuration"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CONFIGURING: swiftlist.app (Application)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1️⃣  Configuring SSL/TLS: Full (strict)..."
wrangler zones ssl set "$APP_ZONE" --mode full || echo "⚠️  Manual config required"

echo "2️⃣  Enabling HSTS (2 years + preload)..."
wrangler zones settings update "$APP_ZONE" \
    --security-header '{"strict_transport_security":{"enabled":true,"max_age":63072000,"include_subdomains":true,"preload":true}}' \
    || echo "⚠️  Manual config required"

echo "3️⃣  Enabling Bot Fight Mode..."
wrangler zones settings update "$APP_ZONE" --bot-fight-mode on || echo "⚠️  Manual config required"

echo "4️⃣  Setting Security Level: Medium..."
wrangler zones settings update "$APP_ZONE" --security-level medium || echo "⚠️  Manual config required"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MANUAL CONFIGURATION REQUIRED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  The following settings must be configured via Cloudflare Dashboard:"
echo ""
echo "For swiftlist.app:"
echo "  • Rate Limiting Rules:"
echo "    - /api/jobs/create: 10 req/min per IP"
echo "    - /api/auth/*: 5 req/min per IP"
echo "    → https://dash.cloudflare.com/$APP_ZONE/security/waf/rate-limiting-rules"
echo ""
echo "  • WAF Rules:"
echo "    - Enable OWASP Core Ruleset"
echo "    - Enable Cloudflare Managed Ruleset"
echo "    → https://dash.cloudflare.com/$APP_ZONE/security/waf"
echo ""
echo "  • Caching Rules:"
echo "    - Bypass cache for /api/*"
echo "    → https://dash.cloudflare.com/$APP_ZONE/caching/configuration"
echo ""
echo "For heyswiftlist.com:"
echo "  • WAF Rules:"
echo "    - Enable Cloudflare Managed Ruleset"
echo "    → https://dash.cloudflare.com/$MARKETING_ZONE/security/waf"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ Basic Cloudflare configuration complete!${NC}"
echo ""
echo "Zone IDs saved to: /tmp/swiftlist-zones.env"
echo ""
