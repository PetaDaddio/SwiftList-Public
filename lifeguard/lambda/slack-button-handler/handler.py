"""
SwiftList Lifeguard - Slack Button Handler Lambda

This Lambda function:
1. Receives Slack interactive button clicks
2. Verifies Slack request signature
3. Triggers appropriate actions (approve fix, view logs, ignore)
4. Updates Slack message with status
5. Triggers GitHub Actions workflow for auto-deployment
"""

import os
import json
import boto3
import hashlib
import hmac
import time
from urllib.parse import parse_qs
from typing import Dict, Optional
import requests

# AWS clients
ssm_client = boto3.client('ssm')
dynamodb = boto3.resource('dynamodb')
events_client = boto3.client('events')

# DynamoDB table
audit_table = dynamodb.Table(os.environ.get('AUDIT_TABLE_NAME', 'swiftlist-error-audit'))

# SSM parameter cache
_ssm_cache = {}


def get_ssm_parameter(name: str, with_decryption: bool = True) -> str:
    """Get parameter from AWS Systems Manager Parameter Store with caching"""
    if name in _ssm_cache:
        return _ssm_cache[name]

    try:
        response = ssm_client.get_parameter(
            Name=name,
            WithDecryption=with_decryption
        )
        value = response['Parameter']['Value']
        _ssm_cache[name] = value
        return value
    except Exception as e:
        print(f"Error fetching SSM parameter {name}: {str(e)}")
        raise


def verify_slack_signature(event: Dict) -> bool:
    """Verify that request came from Slack"""
    try:
        # Get Slack signing secret
        signing_secret = get_ssm_parameter('/swiftlist/slack/signing-secret')

        # Extract headers
        headers = event.get('headers', {})
        timestamp = headers.get('X-Slack-Request-Timestamp', headers.get('x-slack-request-timestamp', ''))
        signature = headers.get('X-Slack-Signature', headers.get('x-slack-signature', ''))

        # Check if timestamp is recent (within 5 minutes)
        if abs(time.time() - int(timestamp)) > 300:
            print("Request timestamp is too old")
            return False

        # Get request body
        body = event.get('body', '')

        # Compute signature
        sig_basestring = f"v0:{timestamp}:{body}"
        computed_signature = 'v0=' + hmac.new(
            signing_secret.encode(),
            sig_basestring.encode(),
            hashlib.sha256
        ).hexdigest()

        # Compare signatures
        return hmac.compare_digest(computed_signature, signature)

    except Exception as e:
        print(f"Error verifying Slack signature: {str(e)}")
        return False


def trigger_github_workflow(action_data: Dict, analysis_data: Dict) -> bool:
    """Trigger GitHub Actions workflow for auto-deployment"""
    try:
        # Get GitHub token from SSM
        github_token = get_ssm_parameter('/swiftlist/github/actions-token')

        # GitHub API endpoint
        repo_owner = 'PetaDaddio'
        repo_name = 'SwiftList_Source'
        workflow_id = 'auto-fix-deployment.yml'

        url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/actions/workflows/{workflow_id}/dispatches"

        # Prepare workflow inputs
        inputs = {
            'alarm_name': action_data.get('alarm_name', 'Unknown'),
            'proposed_fix': analysis_data.get('proposed_fix', ''),
            'code_diff': analysis_data.get('code_diff', ''),
            'urgency': analysis_data.get('urgency', 'medium'),
            'approved_by': action_data.get('user_name', 'automated'),
            'analysis_id': action_data.get('analysis_id', '')
        }

        # Trigger workflow
        response = requests.post(
            url,
            headers={
                'Authorization': f'token {github_token}',
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            json={
                'ref': 'main',
                'inputs': inputs
            },
            timeout=10
        )

        response.raise_for_status()

        print(f"GitHub Actions workflow triggered successfully")
        return True

    except Exception as e:
        print(f"Error triggering GitHub workflow: {str(e)}")
        return False


def update_slack_message(response_url: str, new_message: Dict) -> bool:
    """Update the original Slack message"""
    try:
        response = requests.post(
            response_url,
            json=new_message,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )

        response.raise_for_status()
        return True

    except Exception as e:
        print(f"Error updating Slack message: {str(e)}")
        return False


def handle_approve_action(payload: Dict, action_data: Dict) -> Dict:
    """Handle 'Approve & Deploy Fix' button click"""
    try:
        user_name = payload['user']['name']
        alarm_name = action_data.get('alarm_name', 'Unknown')

        print(f"User {user_name} approved fix for alarm: {alarm_name}")

        # Retrieve analysis from DynamoDB
        # (In production, use analysis_id to fetch exact analysis)
        analysis_data = {
            'proposed_fix': 'Retrieved from DynamoDB',
            'code_diff': '',
            'urgency': 'high'
        }

        # Trigger GitHub Actions workflow
        workflow_triggered = trigger_github_workflow(
            {**action_data, 'user_name': user_name},
            analysis_data
        )

        if workflow_triggered:
            # Update Slack message
            return {
                'replace_original': True,
                'text': f"✅ *Fix Approved by @{user_name}*",
                'attachments': [{
                    'color': '#0066cc',
                    'title': '🚀 Deployment in Progress',
                    'text': f"*Alarm:* {alarm_name}\n*Approved by:* @{user_name}\n*Status:* GitHub Actions workflow triggered",
                    'fields': [
                        {
                            'title': 'Deployment Pipeline',
                            'value': '1️⃣ Running tests...\n2️⃣ Building application...\n3️⃣ Deploying to production...',
                            'short': False
                        },
                        {
                            'title': 'Track Progress',
                            'value': '<https://github.com/PetaDaddio/SwiftList_Source/actions|View GitHub Actions>',
                            'short': False
                        }
                    ],
                    'footer': 'SwiftList Lifeguard AI',
                    'footer_icon': 'https://platform.slack-edge.com/img/default_application_icon.png'
                }]
            }
        else:
            return {
                'replace_original': True,
                'text': f"❌ *Deployment Failed*",
                'attachments': [{
                    'color': '#ff0000',
                    'title': 'Error Triggering GitHub Actions',
                    'text': 'Failed to trigger auto-deployment workflow. Please deploy manually.',
                    'footer': 'SwiftList Lifeguard AI'
                }]
            }

    except Exception as e:
        print(f"Error handling approve action: {str(e)}")
        return {
            'text': f"❌ Error processing approval: {str(e)}"
        }


def handle_view_logs_action(payload: Dict, action_data: Dict) -> Dict:
    """Handle 'View Logs' button click"""
    try:
        alarm_name = action_data.get('alarm_name', 'Unknown')
        region = os.environ.get('AWS_REGION', 'us-east-1')
        log_group = os.environ.get('LOG_GROUP_NAME', '/aws/amplify/swiftlist-app-production')

        # Build CloudWatch Logs Insights URL
        logs_url = f"https://console.aws.amazon.com/cloudwatch/home?region={region}#logsV2:logs-insights"

        return {
            'replace_original': False,  # Don't replace, send ephemeral message
            'response_type': 'ephemeral',
            'text': f"📊 *CloudWatch Logs for {alarm_name}*",
            'attachments': [{
                'color': '#0066cc',
                'text': f"View recent logs in CloudWatch Logs Insights:\n<{logs_url}|Open CloudWatch Logs>",
                'fields': [
                    {
                        'title': 'Log Group',
                        'value': log_group,
                        'short': True
                    },
                    {
                        'title': 'Time Range',
                        'value': 'Last 15 minutes',
                        'short': True
                    }
                ]
            }]
        }

    except Exception as e:
        print(f"Error handling view logs action: {str(e)}")
        return {
            'text': f"❌ Error: {str(e)}"
        }


def handle_ignore_action(payload: Dict, action_data: Dict) -> Dict:
    """Handle 'Ignore' button click"""
    try:
        user_name = payload['user']['name']
        alarm_name = action_data.get('alarm_name', 'Unknown')

        print(f"User {user_name} ignored alarm: {alarm_name}")

        return {
            'replace_original': True,
            'text': f"⏭️ *Alert Ignored by @{user_name}*",
            'attachments': [{
                'color': '#666666',
                'title': f"Alert: {alarm_name}",
                'text': f"Marked as false alarm by @{user_name}",
                'footer': 'SwiftList Lifeguard AI'
            }]
        }

    except Exception as e:
        print(f"Error handling ignore action: {str(e)}")
        return {
            'text': f"❌ Error: {str(e)}"
        }


def lambda_handler(event, context):
    """
    Main Lambda handler for Slack interactive components

    Expected event format (from API Gateway):
    {
      "body": "payload=<URL_encoded_JSON>",
      "headers": {
        "X-Slack-Signature": "v0=...",
        "X-Slack-Request-Timestamp": "1234567890"
      }
    }
    """
    try:
        print(f"Received event: {json.dumps(event)}")

        # Verify Slack signature
        if not verify_slack_signature(event):
            print("Invalid Slack signature")
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Invalid signature'})
            }

        # Parse payload
        body = event.get('body', '')
        params = parse_qs(body)
        payload_str = params.get('payload', ['{}'])[0]
        payload = json.loads(payload_str)

        print(f"Payload: {json.dumps(payload)}")

        # Extract action data
        actions = payload.get('actions', [])
        if not actions:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No actions found'})
            }

        action = actions[0]
        action_value = json.loads(action.get('value', '{}'))
        action_type = action_value.get('action')

        print(f"Action type: {action_type}")

        # Get response URL for updating message
        response_url = payload.get('response_url')

        # Handle different action types
        if action_type == 'approve_fix':
            response_message = handle_approve_action(payload, action_value)
        elif action_type == 'view_logs':
            response_message = handle_view_logs_action(payload, action_value)
        elif action_type == 'ignore':
            response_message = handle_ignore_action(payload, action_value)
        else:
            response_message = {
                'text': f"❌ Unknown action: {action_type}"
            }

        # Update Slack message
        if response_url:
            update_slack_message(response_url, response_message)

        # Respond immediately to Slack (within 3 seconds)
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Action processed'})
        }

    except Exception as e:
        print(f"Error in lambda_handler: {str(e)}")
        import traceback
        traceback.print_exc()

        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Error processing Slack action'
            })
        }
