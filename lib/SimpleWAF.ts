import { CfnOutput, Duration, Stack, Fn, ArnFormat } from 'aws-cdk-lib'
import { Bucket, StorageClass } from 'aws-cdk-lib/aws-s3'
import {
  CfnWebACL,
  CfnWebACLAssociation,
  CfnLoggingConfiguration,
} from 'aws-cdk-lib/aws-wafv2'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

export interface SimpleWAFProps {
  /**
   * The ARN of the AppSync GraphQL API to protect
   */
  graphqlApiArn: string
  /**
   * Environment name for resource naming
   */
  environment: string
}

export class SimpleWAF extends Construct {
  public readonly webAcl: CfnWebACL
  public readonly logGroup: LogGroup

  constructor(scope: Construct, id: string, props: SimpleWAFProps) {
    super(scope, id)

    const { graphqlApiArn, environment } = props

    // Create log group with proper WAF naming convention and 90-day retention
    this.logGroup = new LogGroup(this, 'WAFLogGroup', {
      logGroupName: `aws-waf-logs-${environment}-appsync`,
      retention: RetentionDays.THREE_MONTHS, // 90 days as per JIRA requirements
    })

    // S3 Bucket for WAF log storage (optional for testing)
    const logsBucket = new Bucket(this, 'WAFLogsBucket', {
      bucketName: `${environment}-waf-logs-${Date.now()}`.toLowerCase(),
      lifecycleRules: [
        {
          id: 'waf-logs-lifecycle',
          enabled: true,
          transitions: [
            {
              storageClass: StorageClass.INFREQUENT_ACCESS,
              transitionAfter: Duration.days(30),
            },
          ],
        },
      ],
    })

    // Simplified WAF Web ACL with essential rules only
    this.webAcl = new CfnWebACL(this, 'TestWebACL', {
      name: `${environment}-test-waf`,
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      description: 'Test WAF Web ACL for AppSync GraphQL API protection',
      
      rules: [
        // AWS Managed Core Rule Set (essential protection)
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSetMetric',
          },
        },

        // Geographic restriction - US only (simplified)
        {
          name: 'GeographicRestriction',
          priority: 2,
          action: { block: {} },
          statement: {
            notStatement: {
              statement: {
                geoMatchStatement: {
                  countryCodes: ['US'],
                },
              },
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'GeographicRestrictionMetric',
          },
        },

        // Rate limiting (test-friendly)
        {
          name: 'RateLimitRule',
          priority: 3,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 1000, // Higher limit for testing
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitMetric',
          },
        },
      ],

      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `${environment}TestWAFMetric`,
      },
    })

    // WAF logging configuration using imported log group
    const loggingConfig = new CfnLoggingConfiguration(this, 'WAFLoggingConfig', {
      resourceArn: this.webAcl.attrArn,
      logDestinationConfigs: [
        // Use Stack.formatArn with COLON_RESOURCE_NAME to avoid :* suffix
        Stack.of(this).formatArn({
          arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          service: 'logs',
          resource: 'log-group',
          resourceName: this.logGroup.logGroupName,
        })
      ],
      loggingFilter: {
        DefaultBehavior: 'KEEP',
        Filters: [
          {
            Behavior: 'KEEP',
            Conditions: [
              {
                ActionCondition: {
                  Action: 'BLOCK',
                },
              },
            ],
            Requirement: 'MEETS_ANY',
          },
        ],
      },
    })
    
    loggingConfig.addDependency(this.webAcl)
    loggingConfig.node.addDependency(this.logGroup)

    // Outputs for testing
    new CfnOutput(this, 'WebACLArn', {
      value: this.webAcl.attrArn,
      description: 'ARN of the test WAF Web ACL',
      exportName: `${environment}-TestWAF-WebACLArn`,
    })

    new CfnOutput(this, 'WAFLogGroupName', {
      value: this.logGroup.logGroupName,
      description: 'CloudWatch Log Group for WAF logs',
      exportName: `${environment}-TestWAF-LogGroup`,
    })

    new CfnOutput(this, 'WAFLogGroupArn', {
      value: this.logGroup.logGroupArn,
      description: 'CloudWatch Log Group ARN for debugging',
      exportName: `${environment}-TestWAF-LogGroupArn`,
    })

    new CfnOutput(this, 'WAFLogsBucketName', {
      value: logsBucket.bucketName,
      description: 'S3 Bucket for WAF log storage',
      exportName: `${environment}-TestWAF-LogsBucket`,
    })
  }
}
