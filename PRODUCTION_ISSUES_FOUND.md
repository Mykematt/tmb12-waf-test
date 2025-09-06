# Production Issues Found in WAF Implementation

## Critical Issues That Will Block Production Deployment

### 1. WAF Log Group Naming Convention Violation
- **Issue**: Log group names must start with `aws-waf-logs-` prefix
- **Current Code**: Uses `/aws/wafv2/appsync/${environment}-waf-logs`
- **Impact**: WAF logging configuration will fail in production
- **AWS Requirement**: `aws-waf-logs-${environment}-appsync`

### 2. CDK v2.87.0 ARN Format Incompatibility
- **Issue**: `logGroup.logGroupArn` includes `:*` suffix that WAF rejects
- **Current Code**: Direct use of CDK's `logGroupArn` property
- **Impact**: All WAF logging deployments will fail with ARN validation errors
- **Required Fix**: Manual ARN construction using `Stack.formatArn()`

### 3. CloudFormation Property Case Sensitivity
- **Issue**: LoggingFilter properties must use PascalCase, not camelCase
- **Current Code**: May use inconsistent casing
- **Impact**: CloudFormation validation failures during deployment
- **AWS Requirement**: `DefaultBehavior`, `Filters`, `Behavior`, etc.

### 4. S3 Lifecycle Configuration Minimums
- **Issue**: AWS requires minimum 30 days before IA transition
- **Current Code**: Uses 7 days for IA transition
- **Impact**: CloudFormation deployment failures
- **AWS Minimum**: 30 days for IA transition
