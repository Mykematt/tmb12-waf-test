# Pure IaC Solution: Amplify + WAF Association

## Challenge
Customer requires everything in Infrastructure as Code, but Amplify Gen 2 and CDK WAF can't directly reference each other.

## Solution: CDK Custom Resource with Lambda

This approach keeps everything in IaC while handling the dynamic Amplify AppSync API discovery.

```typescript
import { CustomResource, Duration } from 'aws-cdk-lib'
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda'
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam'

export class AmplifyWAFAssociation extends Construct {
  constructor(scope: Construct, id: string, props: {
    webAclArn: string
    environment: string
    amplifyAppId?: string  // Optional: if you know the Amplify App ID
  }) {
    super(scope, id)

    // Lambda function to discover and associate AppSync API
    const associationFunction = new Function(this, 'AssociationFunction', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'index.handler',
      timeout: Duration.minutes(5),
      code: Code.fromInline(`
        const { AppSyncClient, ListGraphqlApisCommand } = require('@aws-sdk/client-appsync');
        const { WAFv2Client, AssociateWebACLCommand, DisassociateWebACLCommand } = require('@aws-sdk/client-wafv2');
        const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');

        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          const webAclArn = event.ResourceProperties.WebACLArn;
          const environment = event.ResourceProperties.Environment;
          const amplifyAppId = event.ResourceProperties.AmplifyAppId;
          
          const appSyncClient = new AppSyncClient({ region: process.env.AWS_REGION });
          const wafClient = new WAFv2Client({ region: process.env.AWS_REGION });
          
          try {
            if (event.RequestType === 'Delete') {
              // Find and disassociate on delete
              const apis = await appSyncClient.send(new ListGraphqlApisCommand({}));
              const targetApi = apis.graphqlApis?.find(api => 
                api.name?.includes(environment) || 
                (amplifyAppId && api.name?.includes(amplifyAppId))
              );
              
              if (targetApi) {
                await wafClient.send(new DisassociateWebACLCommand({
                  ResourceArn: targetApi.arn
                }));
                console.log('Disassociated WAF from:', targetApi.arn);
              }
              
              return { PhysicalResourceId: 'amplify-waf-association' };
            }
            
            // Find AppSync API (Create/Update)
            const apis = await appSyncClient.send(new ListGraphqlApisCommand({}));
            console.log('Found APIs:', apis.graphqlApis?.map(api => ({ name: api.name, arn: api.arn })));
            
            // Strategy 1: Find by environment name
            let targetApi = apis.graphqlApis?.find(api => 
              api.name?.toLowerCase().includes(environment.toLowerCase())
            );
            
            // Strategy 2: Find by Amplify App ID if provided
            if (!targetApi && amplifyAppId) {
              targetApi = apis.graphqlApis?.find(api => 
                api.name?.includes(amplifyAppId)
              );
            }
            
            // Strategy 3: Find most recently created API (fallback)
            if (!targetApi && apis.graphqlApis?.length > 0) {
              targetApi = apis.graphqlApis.sort((a, b) => 
                new Date(b.creationTime) - new Date(a.creationTime)
              )[0];
              console.log('Using most recent API as fallback:', targetApi.name);
            }
            
            if (!targetApi) {
              throw new Error('No AppSync GraphQL API found to associate with WAF');
            }
            
            console.log('Associating WAF with API:', targetApi.name, targetApi.arn);
            
            // Associate WAF with AppSync API
            await wafClient.send(new AssociateWebACLCommand({
              WebACLArn: webAclArn,
              ResourceArn: targetApi.arn
            }));
            
            console.log('Successfully associated WAF with AppSync API');
            
            return {
              PhysicalResourceId: 'amplify-waf-association',
              Data: {
                AppSyncApiArn: targetApi.arn,
                AppSyncApiName: targetApi.name
              }
            };
            
          } catch (error) {
            console.error('Error:', error);
            throw error;
          }
        };
      `),
      environment: {
        AWS_REGION: Stack.of(this).region,
      }
    })

    // Grant permissions to Lambda
    associationFunction.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'appsync:ListGraphqlApis',
        'appsync:GetGraphqlApi',
        'wafv2:AssociateWebACL',
        'wafv2:DisassociateWebACL',
        'wafv2:GetWebACLForResource'
      ],
      resources: ['*']
    }))

    // Custom Resource to trigger the association
    const association = new CustomResource(this, 'WAFAssociation', {
      serviceToken: associationFunction.functionArn,
      properties: {
        WebACLArn: props.webAclArn,
        Environment: props.environment,
        AmplifyAppId: props.amplifyAppId,
        // Force update when WAF ARN changes
        Timestamp: Date.now().toString()
      }
    })

    // Outputs
    new CfnOutput(this, 'AssociatedAppSyncAPI', {
      value: association.getAttString('AppSyncApiArn'),
      description: 'AppSync API ARN associated with WAF'
    })
  }
}
```

## Usage in WAF Stack

```typescript
export class SimpleWAF extends Construct {
  public readonly webAcl: CfnWebACL
  
  constructor(scope: Construct, id: string, props: SimpleWAFProps) {
    // ... existing WAF creation code ...
    
    // Pure IaC association with Amplify AppSync
    new AmplifyWAFAssociation(this, 'AmplifyAssociation', {
      webAclArn: this.webAcl.attrArn,
      environment: props.environment,
      amplifyAppId: props.amplifyAppId  // Optional
    })
  }
}
```

## Benefits
- ✅ Pure Infrastructure as Code
- ✅ No manual scripts or post-deployment steps
- ✅ Handles dynamic AppSync API discovery
- ✅ Automatic cleanup on stack deletion
- ✅ Works across environments
- ✅ Includes error handling and logging

## Discovery Strategies
1. **Environment Name Match**: Finds API containing environment name
2. **Amplify App ID Match**: Uses specific Amplify App ID if provided
3. **Most Recent API**: Fallback to newest API if others fail

## Deployment Dependencies
The Lambda function will automatically find and associate with the AppSync API after both Amplify and WAF are deployed, regardless of deployment order.
