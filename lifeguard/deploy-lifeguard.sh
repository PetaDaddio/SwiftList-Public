#!/bin/bash

# SwiftList Lifeguard - Complete Deployment Script
# This script deploys the entire monitoring and auto-fix infrastructure

set -e

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║     SWIFTLIST LIFEGUARD DEPLOYMENT                                  ║"
echo "║     AI-Powered Emergency Alert & Auto-Fix System                    ║"
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
REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="swiftlist-lifeguard"
LAMBDA_RUNTIME="python3.11"
LAMBDA_MEMORY=512  # MB
LAMBDA_TIMEOUT=300  # 5 minutes

# Directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LAMBDA_DIR="$SCRIPT_DIR/lambda"
CLOUDWATCH_DIR="$SCRIPT_DIR/cloudwatch"

echo "🔍 Checking prerequisites..."
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not installed${NC}"
    echo "Install: brew install awscli"
    exit 1
fi

# Check AWS authentication
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with AWS${NC}"
    echo "Run: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS authenticated (Account: $ACCOUNT_ID)${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Python 3 installed${NC}"

# Check zip
if ! command -v zip &> /dev/null; then
    echo -e "${RED}❌ zip not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ zip utility available${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 1: Store Secrets in AWS Systems Manager"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Enter required credentials (will be stored securely in AWS SSM):"
echo ""

# Claude API Key
read -sp "Claude API Key (from https://console.anthropic.com/): " CLAUDE_API_KEY
echo ""

# Slack Webhook URL
read -p "Slack Webhook URL: " SLACK_WEBHOOK_URL

# Slack Bot Token
read -sp "Slack Bot Token (xoxb-...): " SLACK_BOT_TOKEN
echo ""

# Slack Signing Secret
read -sp "Slack Signing Secret: " SLACK_SIGNING_SECRET
echo ""

# GitHub Token
read -sp "GitHub Personal Access Token (for triggering workflows): " GITHUB_TOKEN
echo ""
echo ""

echo "Storing secrets in AWS Systems Manager Parameter Store..."

aws ssm put-parameter \
  --name "/swiftlist/anthropic/api-key" \
  --type "SecureString" \
  --value "$CLAUDE_API_KEY" \
  --overwrite &> /dev/null

echo -e "${GREEN}✓ Claude API key stored${NC}"

aws ssm put-parameter \
  --name "/swiftlist/slack/webhook-url" \
  --type "SecureString" \
  --value "$SLACK_WEBHOOK_URL" \
  --overwrite &> /dev/null

echo -e "${GREEN}✓ Slack webhook URL stored${NC}"

aws ssm put-parameter \
  --name "/swiftlist/slack/bot-token" \
  --type "SecureString" \
  --value "$SLACK_BOT_TOKEN" \
  --overwrite &> /dev/null

echo -e "${GREEN}✓ Slack bot token stored${NC}"

aws ssm put-parameter \
  --name "/swiftlist/slack/signing-secret" \
  --type "SecureString" \
  --value "$SLACK_SIGNING_SECRET" \
  --overwrite &> /dev/null

echo -e "${GREEN}✓ Slack signing secret stored${NC}"

aws ssm put-parameter \
  --name "/swiftlist/github/actions-token" \
  --type "SecureString" \
  --value "$GITHUB_TOKEN" \
  --overwrite &> /dev/null

echo -e "${GREEN}✓ GitHub token stored${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 2: Create DynamoDB Audit Table"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TABLE_NAME="swiftlist-error-audit"

if aws dynamodb describe-table --table-name "$TABLE_NAME" &> /dev/null; then
    echo -e "${YELLOW}⚠️  Table $TABLE_NAME already exists${NC}"
else
    echo "Creating DynamoDB table: $TABLE_NAME..."

    aws dynamodb create-table \
      --table-name "$TABLE_NAME" \
      --attribute-definitions \
        AttributeName=alarm_name,AttributeType=S \
        AttributeName=timestamp,AttributeType=S \
      --key-schema \
        AttributeName=alarm_name,KeyType=HASH \
        AttributeName=timestamp,KeyType=RANGE \
      --billing-mode PAY_PER_REQUEST \
      --tags Key=Project,Value=SwiftList Key=Component,Value=Lifeguard \
      --region "$REGION" \
      > /dev/null

    echo -e "${GREEN}✓ DynamoDB table created${NC}"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 3: Package and Deploy Lambda Functions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to package Lambda
package_lambda() {
    local function_name=$1
    local function_dir="$LAMBDA_DIR/$function_name"
    local package_dir="/tmp/$function_name-package"
    local zip_file="/tmp/$function_name.zip"

    echo "Packaging Lambda: $function_name..."

    # Clean and create package directory
    rm -rf "$package_dir" "$zip_file"
    mkdir -p "$package_dir"

    # Install dependencies
    if [ -f "$function_dir/requirements.txt" ]; then
        pip3 install -r "$function_dir/requirements.txt" -t "$package_dir" --quiet
    fi

    # Copy handler
    cp "$function_dir/handler.py" "$package_dir/"

    # Create zip
    cd "$package_dir"
    zip -r "$zip_file" . > /dev/null
    cd - > /dev/null

    echo "$zip_file"
}

# Package Error Analyzer Lambda
echo "1️⃣  Error Analyzer Lambda..."
ERROR_ANALYZER_ZIP=$(package_lambda "error-analyzer")
echo -e "${GREEN}✓ Packaged: $ERROR_ANALYZER_ZIP${NC}"

# Package Button Handler Lambda
echo "2️⃣  Slack Button Handler Lambda..."
BUTTON_HANDLER_ZIP=$(package_lambda "slack-button-handler")
echo -e "${GREEN}✓ Packaged: $BUTTON_HANDLER_ZIP${NC}"
echo ""

# Create IAM role for Lambda
echo "Creating IAM role for Lambda functions..."

ROLE_NAME="SwiftListLifeguardLambdaRole"

if aws iam get-role --role-name "$ROLE_NAME" &> /dev/null; then
    echo -e "${YELLOW}⚠️  IAM role already exists${NC}"
    ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
else
    # Create trust policy
    cat > /tmp/trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    ROLE_ARN=$(aws iam create-role \
      --role-name "$ROLE_NAME" \
      --assume-role-policy-document file:///tmp/trust-policy.json \
      --query 'Role.Arn' \
      --output text)

    # Attach policies
    aws iam attach-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"

    aws iam attach-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-arn "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"

    # Create custom policy for SSM and DynamoDB
    cat > /tmp/lambda-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/swiftlist/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${TABLE_NAME}"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:FilterLogEvents"
      ],
      "Resource": "arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:*"
    }
  ]
}
EOF

    aws iam put-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-name "SwiftListLifeguardPolicy" \
      --policy-document file:///tmp/lambda-policy.json

    echo -e "${GREEN}✓ IAM role created: $ROLE_ARN${NC}"

    # Wait for role to be available
    echo "Waiting for IAM role to propagate..."
    sleep 10
fi
echo ""

# Deploy Error Analyzer Lambda
echo "Deploying Error Analyzer Lambda..."

ERROR_ANALYZER_NAME="swiftlist-error-analyzer"

if aws lambda get-function --function-name "$ERROR_ANALYZER_NAME" &> /dev/null; then
    echo "Updating existing function..."
    aws lambda update-function-code \
      --function-name "$ERROR_ANALYZER_NAME" \
      --zip-file "fileb://$ERROR_ANALYZER_ZIP" \
      > /dev/null
else
    echo "Creating new function..."
    aws lambda create-function \
      --function-name "$ERROR_ANALYZER_NAME" \
      --runtime "$LAMBDA_RUNTIME" \
      --role "$ROLE_ARN" \
      --handler "handler.lambda_handler" \
      --zip-file "fileb://$ERROR_ANALYZER_ZIP" \
      --timeout "$LAMBDA_TIMEOUT" \
      --memory-size "$LAMBDA_MEMORY" \
      --environment "Variables={
        AUDIT_TABLE_NAME=$TABLE_NAME,
        LOG_GROUP_NAME=/aws/amplify/swiftlist-app-production
      }" \
      --tags "Project=SwiftList,Component=Lifeguard" \
      > /dev/null
fi

ERROR_ANALYZER_ARN=$(aws lambda get-function --function-name "$ERROR_ANALYZER_NAME" --query 'Configuration.FunctionArn' --output text)

echo -e "${GREEN}✓ Error Analyzer deployed: $ERROR_ANALYZER_ARN${NC}"
echo ""

# Deploy Button Handler Lambda with Function URL
echo "Deploying Slack Button Handler Lambda..."

BUTTON_HANDLER_NAME="swiftlist-slack-button-handler"

if aws lambda get-function --function-name "$BUTTON_HANDLER_NAME" &> /dev/null; then
    echo "Updating existing function..."
    aws lambda update-function-code \
      --function-name "$BUTTON_HANDLER_NAME" \
      --zip-file "fileb://$BUTTON_HANDLER_ZIP" \
      > /dev/null
else
    echo "Creating new function..."
    aws lambda create-function \
      --function-name "$BUTTON_HANDLER_NAME" \
      --runtime "$LAMBDA_RUNTIME" \
      --role "$ROLE_ARN" \
      --handler "handler.lambda_handler" \
      --zip-file "fileb://$BUTTON_HANDLER_ZIP" \
      --timeout 30 \
      --memory-size 256 \
      --environment "Variables={
        AUDIT_TABLE_NAME=$TABLE_NAME
      }" \
      --tags "Project=SwiftList,Component=Lifeguard" \
      > /dev/null

    # Create Function URL
    FUNCTION_URL=$(aws lambda create-function-url-config \
      --function-name "$BUTTON_HANDLER_NAME" \
      --auth-type NONE \
      --query 'FunctionUrl' \
      --output text)

    # Add permission for public invocation
    aws lambda add-permission \
      --function-name "$BUTTON_HANDLER_NAME" \
      --statement-id "FunctionURLAllowPublicAccess" \
      --action "lambda:InvokeFunctionUrl" \
      --principal "*" \
      --function-url-auth-type NONE \
      > /dev/null

    echo -e "${BLUE}📍 Function URL: $FUNCTION_URL${NC}"
    echo -e "${YELLOW}⚠️  Update this URL in Slack App Settings → Interactivity & Shortcuts${NC}"
fi

BUTTON_HANDLER_ARN=$(aws lambda get-function --function-name "$BUTTON_HANDLER_NAME" --query 'Configuration.FunctionArn' --output text)

echo -e "${GREEN}✓ Button Handler deployed: $BUTTON_HANDLER_ARN${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 4: Deploy CloudWatch Alarms"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Deploying CloudFormation stack for CloudWatch alarms..."

aws cloudformation deploy \
  --template-file "$CLOUDWATCH_DIR/alarms.yaml" \
  --stack-name "$STACK_NAME-alarms" \
  --parameter-overrides \
    ErrorAnalyzerLambdaArn="$ERROR_ANALYZER_ARN" \
    SlackWebhookUrl="$SLACK_WEBHOOK_URL" \
    AppName="swiftlist-app-production" \
    LogGroupName="/aws/amplify/swiftlist-app-production" \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset

echo -e "${GREEN}✓ CloudWatch alarms deployed${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 5: Setup GitHub Actions Workflow"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Copying GitHub Actions workflow to repository..."

GITHUB_WORKFLOWS_DIR="../../.github/workflows"
mkdir -p "$GITHUB_WORKFLOWS_DIR"

cp "$SCRIPT_DIR/github-actions/auto-fix-deployment.yml" "$GITHUB_WORKFLOWS_DIR/"

echo -e "${GREEN}✓ GitHub Actions workflow copied${NC}"
echo ""

echo -e "${YELLOW}⚠️  Required GitHub Secrets:${NC}"
echo "   Add these secrets to your GitHub repository:"
echo "   https://github.com/PetaDaddio/SwiftList_Source/settings/secrets/actions"
echo ""
echo "   Required secrets:"
echo "     - NEXT_PUBLIC_SUPABASE_URL"
echo "     - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "     - SLACK_WEBHOOK_URL"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DEPLOYMENT SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ SwiftList Lifeguard deployed successfully!${NC}"
echo ""
echo "📊 CloudWatch Dashboard:"
echo "   https://console.aws.amazon.com/cloudwatch/home?region=$REGION#dashboards:name=SwiftList-Production-Monitoring"
echo ""
echo "⚡ Lambda Functions:"
echo "   Error Analyzer: $ERROR_ANALYZER_NAME"
echo "   Button Handler: $BUTTON_HANDLER_NAME"
echo ""
echo "🔔 Slack Channel:"
echo "   #swiftlist-alerts"
echo ""
echo "📝 DynamoDB Audit Table:"
echo "   $TABLE_NAME"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NEXT STEPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Update Slack App Settings:"
echo "   - Go to: https://api.slack.com/apps"
echo "   - Select: SwiftList Lifeguard"
echo "   - Features → Interactivity & Shortcuts"
echo "   - Request URL: [Function URL from above]"
echo ""
echo "2. Add GitHub Secrets (see list above)"
echo ""
echo "3. Test the system:"
echo "   - Trigger a test alarm"
echo "   - Check Slack for alert"
echo "   - Approve fix and verify deployment"
echo ""
echo "4. Review documentation:"
echo "   - $SCRIPT_DIR/docs/SLACK-SETUP.md"
echo "   - $SCRIPT_DIR/docs/LIFEGUARD-ARCHITECTURE.md"
echo ""
echo -e "${GREEN}🎉 Lifeguard is now protecting SwiftList!${NC}"
echo ""
