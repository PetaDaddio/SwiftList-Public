"""
SwiftList Lifeguard - Error Analyzer Lambda Function

This Lambda function:
1. Receives CloudWatch alarm events
2. Fetches relevant log entries
3. Analyzes errors using Claude API
4. Sends Slack alerts with fix proposals
5. Stores analysis for audit trail
"""

import os
import json
import boto3
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import anthropic
import requests

# AWS clients
logs_client = boto3.client('logs')
ssm_client = boto3.client('ssm')
dynamodb = boto3.resource('dynamodb')

# DynamoDB table for audit trail
audit_table = dynamodb.Table(os.environ.get('AUDIT_TABLE_NAME', 'swiftlist-error-audit'))

# Cache for SSM parameters (reduce API calls)
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


def fetch_cloudwatch_logs(log_group: str, minutes: int = 15, filter_pattern: str = None) -> List[str]:
    """Fetch recent log entries from CloudWatch Logs"""
    try:
        start_time = int((datetime.now() - timedelta(minutes=minutes)).timestamp() * 1000)
        end_time = int(datetime.now().timestamp() * 1000)

        params = {
            'logGroupName': log_group,
            'startTime': start_time,
            'endTime': end_time,
            'limit': 100
        }

        if filter_pattern:
            params['filterPattern'] = filter_pattern

        response = logs_client.filter_log_events(**params)

        return [event['message'] for event in response.get('events', [])]
    except Exception as e:
        print(f"Error fetching CloudWatch logs: {str(e)}")
        return []


def analyze_error_with_claude(alarm_data: Dict, logs: List[str]) -> Dict:
    """Analyze error using Claude API"""
    try:
        # Get Claude API key from SSM
        api_key = get_ssm_parameter('/swiftlist/anthropic/api-key')

        # Initialize Claude client
        client = anthropic.Anthropic(api_key=api_key)

        # Prepare context for Claude
        alarm_name = alarm_data['alarmName']
        state = alarm_data['state']['value']
        reason = alarm_data['state']['reason']
        timestamp = alarm_data['state']['timestamp']

        # Sample logs (take most recent 30)
        log_sample = '\n'.join(logs[-30:]) if logs else 'No logs available'

        # Construct analysis prompt
        prompt = f"""You are a senior DevOps engineer analyzing a production error for SwiftList, an AI-powered listing image processing platform.

**ALARM DETAILS:**
- Alarm Name: {alarm_name}
- Current State: {state}
- Reason: {reason}
- Timestamp: {timestamp}

**RECENT APPLICATION LOGS:**
```
{log_sample}
```

**YOUR TASK:**
Analyze this production error and provide actionable intelligence for the on-call engineer.

**CONTEXT ABOUT SWIFTLIST:**
- Next.js 16 application with App Router
- Supabase for PostgreSQL database (with RLS)
- n8n workflows for AI image processing
- AWS Amplify for hosting
- Cloudflare for CDN/security
- Claude API & Gemini Vision for AI features

**ANALYZE:**
1. **Root Cause**: What is causing this error? (1-2 sentences, be specific)
2. **Affected Users**: How many users are impacted? What can't they do?
3. **Proposed Fix**: Specific code changes, config updates, or SQL migrations
4. **Urgency**: critical (service down), high (degraded), medium (warnings), low (info)
5. **Estimated Fix Time**: Realistic time to implement and deploy (e.g., "5 minutes", "30 minutes", "2 hours")
6. **Code Diff**: If applicable, provide exact code changes in unified diff format
7. **Rollback Plan**: How to safely revert if fix fails
8. **Prevention**: How to prevent this error in the future

**RESPONSE FORMAT (JSON only, no markdown):**
{{
  "root_cause": "Database connection pool exhausted due to missing connection timeout",
  "affected_users": "~500 users - unable to create new jobs or upload images",
  "proposed_fix": "Increase SUPABASE_POOL_SIZE from 10 to 25 and add connection timeout of 30s",
  "urgency": "critical",
  "estimated_fix_time": "5 minutes",
  "code_diff": "--- a/apps/swiftlist-app/lib/supabase/client.ts\\n+++ b/apps/swiftlist-app/lib/supabase/client.ts\\n@@ -5,6 +5,7 @@\\n   supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,\\n   supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,\\n+  poolSize: 25,\\n+  timeout: 30000\\n }}",
  "rollback_plan": "Revert environment variable SUPABASE_POOL_SIZE to 10 if CPU usage spikes above 80%",
  "prevention": "Add connection pool monitoring alarm and implement connection timeout by default",
  "confidence_score": 95
}}

**IMPORTANT:** Respond ONLY with valid JSON. No markdown, no code blocks, just raw JSON."""

        # Call Claude API
        message = client.messages.create(
            model='claude-sonnet-4-20250514',  # Use latest Sonnet model
            max_tokens=3000,
            temperature=0.3,  # Lower temperature for more deterministic analysis
            messages=[{
                'role': 'user',
                'content': prompt
            }]
        )

        # Extract JSON response
        response_text = message.content[0].text.strip()

        # Remove markdown code blocks if present (defensive)
        if response_text.startswith('```'):
            response_text = response_text.split('```')[1]
            if response_text.startswith('json'):
                response_text = response_text[4:]
            response_text = response_text.strip()

        analysis = json.loads(response_text)

        # Add metadata
        analysis['analysis_timestamp'] = datetime.now().isoformat()
        analysis['claude_model'] = 'claude-sonnet-4-20250514'
        analysis['token_usage'] = {
            'input': message.usage.input_tokens,
            'output': message.usage.output_tokens
        }

        return analysis

    except json.JSONDecodeError as e:
        print(f"Error parsing Claude response: {str(e)}")
        print(f"Raw response: {response_text}")

        # Return fallback analysis
        return {
            'root_cause': 'Error analysis failed - unable to parse AI response',
            'affected_users': 'Unknown',
            'proposed_fix': 'Manual investigation required - check CloudWatch logs',
            'urgency': 'high',
            'estimated_fix_time': 'Unknown',
            'code_diff': None,
            'rollback_plan': 'N/A',
            'prevention': 'Improve error analysis prompt',
            'confidence_score': 0,
            'error': str(e)
        }

    except Exception as e:
        print(f"Error calling Claude API: {str(e)}")

        # Return fallback analysis
        return {
            'root_cause': f'Error analysis failed: {str(e)}',
            'affected_users': 'Unknown',
            'proposed_fix': 'Manual investigation required',
            'urgency': 'high',
            'estimated_fix_time': 'Unknown',
            'code_diff': None,
            'rollback_plan': 'N/A',
            'prevention': 'Fix error analysis Lambda function',
            'confidence_score': 0,
            'error': str(e)
        }


def send_slack_alert(alarm_data: Dict, analysis: Dict) -> bool:
    """Send formatted alert to Slack with interactive buttons"""
    try:
        # Get Slack webhook URL from SSM
        webhook_url = get_ssm_parameter('/swiftlist/slack/webhook-url')

        # Determine alert color based on urgency
        color_map = {
            'critical': '#ff0000',  # Red
            'high': '#ff6600',      # Orange
            'medium': '#ffcc00',    # Yellow
            'low': '#00cc00'        # Green
        }
        color = color_map.get(analysis.get('urgency', 'medium'), '#666666')

        # Determine emoji based on urgency
        emoji_map = {
            'critical': ':rotating_light:',
            'high': ':warning:',
            'medium': ':large_yellow_circle:',
            'low': ':information_source:'
        }
        emoji = emoji_map.get(analysis.get('urgency', 'medium'), ':question:')

        # Build Slack message
        alarm_name = alarm_data['alarmName']

        # Create action buttons
        buttons = [
            {
                'type': 'button',
                'text': '✅ Approve & Deploy Fix',
                'style': 'primary',
                'name': 'approve',
                'value': json.dumps({
                    'action': 'approve_fix',
                    'alarm_name': alarm_name,
                    'analysis_id': hashlib.md5(f"{alarm_name}_{datetime.now().isoformat()}".encode()).hexdigest()
                })
            },
            {
                'type': 'button',
                'text': '🔍 View Full Logs',
                'name': 'logs',
                'value': json.dumps({
                    'action': 'view_logs',
                    'alarm_name': alarm_name
                })
            }
        ]

        # Add ignore button only for non-critical alerts
        if analysis.get('urgency') != 'critical':
            buttons.append({
                'type': 'button',
                'text': '❌ Ignore (False Alarm)',
                'style': 'danger',
                'name': 'ignore',
                'value': json.dumps({
                    'action': 'ignore',
                    'alarm_name': alarm_name
                })
            })

        # Build fields
        fields = [
            {
                'title': 'Root Cause',
                'value': analysis.get('root_cause', 'Unknown'),
                'short': False
            },
            {
                'title': 'Affected Users',
                'value': analysis.get('affected_users', 'Unknown'),
                'short': False
            },
            {
                'title': 'Proposed Fix',
                'value': f"```{analysis.get('proposed_fix', 'Manual investigation required')}```",
                'short': False
            }
        ]

        # Add code diff if available
        if analysis.get('code_diff'):
            fields.append({
                'title': 'Code Changes',
                'value': f"```diff\n{analysis['code_diff']}\n```",
                'short': False
            })

        # Add timing fields
        fields.extend([
            {
                'title': 'Estimated Fix Time',
                'value': analysis.get('estimated_fix_time', 'Unknown'),
                'short': True
            },
            {
                'title': 'Confidence Score',
                'value': f"{analysis.get('confidence_score', 0)}%",
                'short': True
            }
        ])

        # Construct Slack message
        message = {
            'channel': '#swiftlist-alerts',
            'username': 'SwiftList Lifeguard',
            'icon_emoji': emoji,
            'text': f"{emoji} *{analysis.get('urgency', 'UNKNOWN').upper()}*: {alarm_name}",
            'attachments': [{
                'color': color,
                'title': f"{emoji} {alarm_name}",
                'text': f"*Urgency:* {analysis.get('urgency', 'unknown').upper()}\n*Time:* {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}",
                'fields': fields,
                'actions': buttons,
                'footer': 'SwiftList Lifeguard AI',
                'footer_icon': 'https://platform.slack-edge.com/img/default_application_icon.png',
                'ts': int(datetime.now().timestamp())
            }]
        }

        # Send to Slack
        response = requests.post(
            webhook_url,
            json=message,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )

        response.raise_for_status()

        print(f"Slack alert sent successfully for alarm: {alarm_name}")
        return True

    except Exception as e:
        print(f"Error sending Slack alert: {str(e)}")
        return False


def store_audit_trail(alarm_data: Dict, analysis: Dict, slack_sent: bool):
    """Store error analysis in DynamoDB for audit trail"""
    try:
        alarm_name = alarm_data['alarmName']
        timestamp = datetime.now().isoformat()

        item = {
            'alarm_name': alarm_name,
            'timestamp': timestamp,
            'alarm_state': alarm_data['state']['value'],
            'alarm_reason': alarm_data['state']['reason'],
            'analysis': analysis,
            'slack_sent': slack_sent,
            'ttl': int((datetime.now() + timedelta(days=90)).timestamp())  # Auto-delete after 90 days
        }

        audit_table.put_item(Item=item)

        print(f"Audit trail stored for alarm: {alarm_name}")

    except Exception as e:
        print(f"Error storing audit trail: {str(e)}")
        # Don't fail the entire function if audit fails


def lambda_handler(event, context):
    """
    Main Lambda handler

    Expected event format (CloudWatch Alarm):
    {
      "detail-type": "CloudWatch Alarm State Change",
      "detail": {
        "alarmName": "SwiftList-API-Error-Rate-Spike",
        "state": {
          "value": "ALARM",
          "reason": "Threshold Crossed: 10 datapoints were greater than the threshold",
          "timestamp": "2026-01-07T21:15:32.000Z"
        }
      }
    }
    """
    try:
        print(f"Received event: {json.dumps(event)}")

        # Extract alarm data
        if 'detail' not in event:
            print("Invalid event format - missing 'detail' key")
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Invalid event format'})
            }

        alarm_data = event['detail']
        alarm_name = alarm_data.get('alarmName', 'Unknown')
        alarm_state = alarm_data.get('state', {}).get('value', 'UNKNOWN')

        print(f"Processing alarm: {alarm_name} (state: {alarm_state})")

        # Only process ALARM state (not OK or INSUFFICIENT_DATA)
        if alarm_state != 'ALARM':
            print(f"Ignoring alarm state: {alarm_state}")
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'Alarm not in ALARM state, skipping'})
            }

        # Fetch relevant logs
        log_group = os.environ.get('LOG_GROUP_NAME', '/aws/amplify/swiftlist-app-production')
        logs = fetch_cloudwatch_logs(log_group, minutes=15)

        print(f"Fetched {len(logs)} log entries")

        # Analyze error with Claude
        analysis = analyze_error_with_claude(alarm_data, logs)

        print(f"Analysis complete. Urgency: {analysis.get('urgency')}, Confidence: {analysis.get('confidence_score')}%")

        # Send Slack alert
        slack_sent = send_slack_alert(alarm_data, analysis)

        # Store audit trail
        store_audit_trail(alarm_data, analysis, slack_sent)

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Error analysis complete',
                'alarm_name': alarm_name,
                'urgency': analysis.get('urgency'),
                'slack_sent': slack_sent
            })
        }

    except Exception as e:
        print(f"Error in lambda_handler: {str(e)}")
        import traceback
        traceback.print_exc()

        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Error analysis failed'
            })
        }
