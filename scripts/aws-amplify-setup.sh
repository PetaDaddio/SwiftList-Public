#!/bin/bash

# SwiftList AWS Amplify Setup Script
# This script creates and configures both Amplify applications

set -e

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║     SWIFTLIST AWS AMPLIFY SETUP                                     ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GITHUB_REPO="PetaDaddio/SwiftList_Source"
GITHUB_BRANCH="main"
REGION="us-east-1"

# Check if authenticated
echo "🔍 Checking AWS authentication..."
if ! aws sts get-caller-identity &>/dev/null; then
    echo -e "${RED}❌ Not authenticated with AWS${NC}"
    echo ""
    echo "Please authenticate using:"
    echo "  aws configure"
    echo ""
    echo "See AWS-SETUP-GUIDE.md for detailed instructions."
    echo ""
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
USER_ARN=$(aws sts get-caller-identity --query Arn --output text)

echo -e "${GREEN}✓ Authenticated with AWS${NC}"
echo "  Account ID: $ACCOUNT_ID"
echo "  User: $USER_ARN"
echo ""

# Check if GitHub token is available
echo "🔑 Checking GitHub authentication..."
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  GITHUB_TOKEN not set${NC}"
    echo ""
    echo "To connect Amplify to your GitHub repository, you need a GitHub Personal Access Token."
    echo ""
    echo "Create one at: https://github.com/settings/tokens/new"
    echo "Required scopes: repo (full control)"
    echo ""
    echo "Then set it as an environment variable:"
    echo "  export GITHUB_TOKEN=ghp_xxxxxxxxxxxx"
    echo ""
    read -p "Enter your GitHub token now (or press Enter to skip GitHub connection): " GITHUB_TOKEN_INPUT
    if [ -n "$GITHUB_TOKEN_INPUT" ]; then
        export GITHUB_TOKEN="$GITHUB_TOKEN_INPUT"
        echo -e "${GREEN}✓ GitHub token set${NC}"
    else
        echo -e "${YELLOW}⚠️  Skipping GitHub connection - you'll need to connect manually${NC}"
    fi
    echo ""
else
    echo -e "${GREEN}✓ GitHub token found${NC}"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CREATING: Marketing Site (heyswiftlist.com)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1️⃣  Creating Amplify app for marketing site..."

# Create marketing app
MARKETING_APP_ID=$(aws amplify create-app \
    --name "swiftlist-marketing-production" \
    --description "SwiftList marketing site (heyswiftlist.com)" \
    --repository "https://github.com/$GITHUB_REPO" \
    --platform WEB \
    --region "$REGION" \
    --custom-rules '[
        {
            "source": "/<*>",
            "target": "/index.html",
            "status": "404-200"
        }
    ]' \
    --build-spec '{
        "version": 1,
        "frontend": {
            "phases": {
                "preBuild": {
                    "commands": [
                        "cd apps/swiftlist-marketing",
                        "npm ci"
                    ]
                },
                "build": {
                    "commands": [
                        "npm run build"
                    ]
                }
            },
            "artifacts": {
                "baseDirectory": "apps/swiftlist-marketing/out",
                "files": [
                    "**/*"
                ]
            },
            "cache": {
                "paths": [
                    "node_modules/**/*"
                ]
            }
        }
    }' \
    --query 'app.appId' \
    --output text)

if [ -z "$MARKETING_APP_ID" ]; then
    echo -e "${RED}❌ Failed to create marketing app${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Marketing app created: $MARKETING_APP_ID${NC}"
echo ""

echo "2️⃣  Connecting to GitHub (if token available)..."
if [ -n "$GITHUB_TOKEN" ]; then
    aws amplify create-branch \
        --app-id "$MARKETING_APP_ID" \
        --branch-name "$GITHUB_BRANCH" \
        --enable-auto-build true \
        --region "$REGION" \
        > /dev/null

    echo -e "${GREEN}✓ Connected to GitHub branch: $GITHUB_BRANCH${NC}"
else
    echo -e "${YELLOW}⚠️  Skipped - connect manually via Amplify Console${NC}"
fi
echo ""

echo "3️⃣  Configuring custom domain..."
# Note: Domain configuration requires manual DNS verification
echo -e "${BLUE}→ Domain configuration must be done via Amplify Console${NC}"
echo "  Link: https://console.aws.amazon.com/amplify/home?region=$REGION#/$MARKETING_APP_ID/settings/domains"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CREATING: Application (swiftlist.app)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1️⃣  Creating Amplify app for application..."

# Create application app
APP_APP_ID=$(aws amplify create-app \
    --name "swiftlist-app-production" \
    --description "SwiftList authenticated application (swiftlist.app)" \
    --repository "https://github.com/$GITHUB_REPO" \
    --platform WEB_COMPUTE \
    --region "$REGION" \
    --build-spec '{
        "version": 1,
        "frontend": {
            "phases": {
                "preBuild": {
                    "commands": [
                        "cd apps/swiftlist-app",
                        "npm ci"
                    ]
                },
                "build": {
                    "commands": [
                        "npm run build"
                    ]
                }
            },
            "artifacts": {
                "baseDirectory": "apps/swiftlist-app/.next",
                "files": [
                    "**/*"
                ]
            },
            "cache": {
                "paths": [
                    "node_modules/**/*",
                    ".next/cache/**/*"
                ]
            }
        }
    }' \
    --query 'app.appId' \
    --output text)

if [ -z "$APP_APP_ID" ]; then
    echo -e "${RED}❌ Failed to create application app${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Application app created: $APP_APP_ID${NC}"
echo ""

echo "2️⃣  Connecting to GitHub..."
if [ -n "$GITHUB_TOKEN" ]; then
    aws amplify create-branch \
        --app-id "$APP_APP_ID" \
        --branch-name "$GITHUB_BRANCH" \
        --enable-auto-build true \
        --region "$REGION" \
        > /dev/null

    echo -e "${GREEN}✓ Connected to GitHub branch: $GITHUB_BRANCH${NC}"
else
    echo -e "${YELLOW}⚠️  Skipped - connect manually via Amplify Console${NC}"
fi
echo ""

echo "3️⃣  Environment variables need to be configured..."
echo -e "${BLUE}→ Add environment variables via Amplify Console:${NC}"
echo "  Link: https://console.aws.amazon.com/amplify/home?region=$REGION#/$APP_APP_ID/settings/variables"
echo ""
echo "  Required variables:"
echo "    - NEXT_PUBLIC_SUPABASE_URL"
echo "    - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "    - SUPABASE_SERVICE_ROLE_KEY"
echo "    - NEXT_PUBLIC_APP_URL=https://swiftlist.app"
echo "    - N8N_WEBHOOK_URL"
echo "    - N8N_WEBHOOK_SECRET"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ Amplify apps created successfully!${NC}"
echo ""
echo "Marketing Site:"
echo "  App ID: $MARKETING_APP_ID"
echo "  Console: https://console.aws.amazon.com/amplify/home?region=$REGION#/$MARKETING_APP_ID"
echo "  Domain: heyswiftlist.com (requires manual setup)"
echo ""
echo "Application:"
echo "  App ID: $APP_APP_ID"
echo "  Console: https://console.aws.amazon.com/amplify/home?region=$REGION#/$APP_APP_ID"
echo "  Domain: swiftlist.app (requires manual setup)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NEXT STEPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Configure environment variables (application only):"
echo "   https://console.aws.amazon.com/amplify/home?region=$REGION#/$APP_APP_ID/settings/variables"
echo ""
echo "2. Connect custom domains:"
echo "   Marketing: https://console.aws.amazon.com/amplify/home?region=$REGION#/$MARKETING_APP_ID/settings/domains"
echo "   App: https://console.aws.amazon.com/amplify/home?region=$REGION#/$APP_APP_ID/settings/domains"
echo ""
echo "3. Add DNS records to Cloudflare (provided after domain connection)"
echo ""
echo "4. Trigger first deployment (auto-triggers on push to main)"
echo ""
echo "App IDs saved to: /tmp/swiftlist-amplify.env"
echo ""

# Save app IDs
cat > /tmp/swiftlist-amplify.env << EOF
# SwiftList AWS Amplify App IDs
MARKETING_APP_ID=$MARKETING_APP_ID
APP_APP_ID=$APP_APP_ID
REGION=$REGION
ACCOUNT_ID=$ACCOUNT_ID
EOF

echo -e "${GREEN}✨ Setup complete!${NC}"
echo ""
