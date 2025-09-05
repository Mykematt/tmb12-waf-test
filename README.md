# TMB-12 WAF Test Project

A scaled-down version of the TMB-12 AWS WAF implementation for testing AppSync GraphQL API protection in test environments.

## Overview

This project creates a simplified WAF Web ACL with essential security rules:
- AWS Managed Core Rule Set (basic protection)
- Geographic restrictions (US-only traffic)
- Rate limiting (1000 requests/5min per IP)
- CloudWatch logging with 1-week retention
- S3 bucket for log storage

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 18+ and npm/yarn
- CDK CLI installed (`npm install -g aws-cdk`)
- An existing AppSync GraphQL API (or use test ARN)

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Bootstrap CDK (if not done already):**
   ```bash
   cdk bootstrap
   ```

3. **Deploy with test ARN:**
   ```bash
   cdk deploy
   ```

4. **Deploy with your AppSync API:**
   ```bash
   cdk deploy -c graphqlApiArn="arn:aws:appsync:us-east-1:123456789012:apis/your-api-id"
   ```

5. **Deploy to specific environment:**
   ```bash
   cdk deploy -c environment="staging" -c graphqlApiArn="your-api-arn"
   ```

## Testing

### Verify WAF Protection
1. Check AWS Console → WAF & Shield → Web ACLs
2. Look for `{environment}-test-waf` Web ACL
3. Verify it's associated with your AppSync API

### Test Geographic Blocking
```bash
# This should work (from US)
curl -X POST https://your-appsync-endpoint/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'

# Simulate non-US traffic (will be blocked)
# Use VPN or proxy from outside US
```

### Monitor Logs
- CloudWatch Logs: `/aws/wafv2/appsync/{environment}-waf-logs`
- S3 Bucket: `{environment}-waf-logs-{timestamp}`

## Configuration

### Environment Variables
- `CDK_DEFAULT_ACCOUNT`: Your AWS account ID
- `CDK_DEFAULT_REGION`: AWS region (default: us-east-1)

### Context Parameters
- `environment`: Environment name (default: "test")
- `graphqlApiArn`: Your AppSync GraphQL API ARN

## Cleanup

```bash
cdk destroy
```

## Differences from Production Version

**Simplified for Testing:**
- Only 3 WAF rules (vs 8 in production)
- Higher rate limits (1000 vs 100 requests)
- Shorter log retention (1 week vs 90 days)
- No advanced managed rule sets
- Simplified S3 lifecycle (7 days vs 30/90 days)

**Same Core Protection:**
- Geographic restrictions
- Basic AWS managed rules
- Rate limiting
- Complete logging setup

## Troubleshooting

### Common Issues

1. **WAF not blocking traffic:**
   - Check Web ACL association in AWS Console
   - Verify AppSync API ARN is correct
   - Wait 5-10 minutes for propagation

2. **Deployment fails:**
   - Ensure CDK is bootstrapped in your region
   - Check AWS credentials and permissions
   - Verify unique S3 bucket naming

3. **No logs appearing:**
   - WAF logs can take 5-15 minutes to appear
   - Check CloudWatch log group permissions
   - Verify logging configuration in Web ACL

### Useful Commands

```bash
# Check synthesis
cdk synth

# View differences
cdk diff

# List stacks
cdk list

# Check WAF rules
aws wafv2 get-web-acl --scope REGIONAL --id <web-acl-id>
```

## Production Deployment

When ready for production:
1. Use the full TMB-12 implementation from `/Users/michaelomoge/OpsGuru/tmb-12-configure-aws-waf-appsync-protection/`
2. Update to production-grade settings
3. Add all 8 security rule sets
4. Configure proper log retention and lifecycle policies
