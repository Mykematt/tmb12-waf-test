## **📝 Research Notes - CloudWatch Log ARN Rejection Issue**

Based on my research, I've identified the root causes and potential fixes:

### **🔍 Primary Issues Found:**

1. **Log Group Naming Convention**
   - WAF requires log group names to start with `aws-waf-logs-` prefix
   - Current implementation uses `/aws/wafv2/appsync/${environment}-waf-logs` ❌
   - Should be `aws-waf-logs-${environment}-appsync` ✅

2. **ARN Format Problem**
   - CloudWatch LogGroup.logGroupArn includes `:*` suffix
   - WAF logging rejects ARNs ending with `:*`
   - Need to construct ARN manually using `Stack.formatArn()` with `ArnFormat.COLON_RESOURCE_NAME`

3. **Regional Requirements**
   - For regional WAF (AppSync): log group can be in same region
   - For CloudFront WAF: log group MUST be in us-east-1

### **🛠️ Required Fixes:**

1. **Change log group name pattern:**
   ```typescript
   // Current (failing)
   logGroupName: `/aws/wafv2/appsync/${environment}-waf-logs`
   
   // Should be
   logGroupName: `aws-waf-logs-${environment}-appsync`
   ```

2. **Fix ARN construction:**
   ```typescript
   // Current (failing)
   logDestinationConfigs: [this.logGroup.logGroupArn]
   
   // Should be
   logDestinationConfigs: [
     Stack.of(this).formatArn({
       arnFormat: ArnFormat.COLON_RESOURCE_NAME,
       service: 'logs',
       resource: 'log-group',
       resourceName: this.logGroup.logGroupName,
     })
   ]
   ```

Ready to implement these fixes when you give the go-ahead! 🔧
