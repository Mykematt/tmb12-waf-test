import { CfnOutput, Duration } from 'aws-cdk-lib'
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

    // CloudWatch Log Group for WAF logs
    this.logGroup = new LogGroup(this, 'WAFLogGroup', {
      logGroupName: `/aws/wafv2/appsync/${environment}-waf-logs`,
      retention: RetentionDays.ONE_WEEK, // Shorter retention for testing
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
              transitionAfter: Duration.days(7),
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

    // Associate WAF with AppSync GraphQL API
    new CfnWebACLAssociation(this, 'WAFAssociation', {
      resourceArn: graphqlApiArn,
      webAclArn: this.webAcl.attrArn,
    })

    // Configure WAF logging
    new CfnLoggingConfiguration(this, 'WAFLoggingConfig', {
      resourceArn: this.webAcl.attrArn,
      logDestinationConfigs: [this.logGroup.logGroupArn],
      loggingFilter: {
        defaultBehavior: 'KEEP',
        filters: [
          {
            behavior: 'KEEP',
            conditions: [
              {
                actionCondition: {
                  action: 'BLOCK',
                },
              },
            ],
            requirement: 'MEETS_ANY',
          },
        ],
      },
    })

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

    new CfnOutput(this, 'WAFLogsBucketName', {
      value: logsBucket.bucketName,
      description: 'S3 Bucket for WAF log storage',
      exportName: `${environment}-TestWAF-LogsBucket`,
    })
  }
}
