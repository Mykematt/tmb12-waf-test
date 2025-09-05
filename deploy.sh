#!/bin/bash

# TMB-12 WAF Test Deployment Script
set -e

echo "🛡️  TMB-12 WAF Test Deployment"
echo "================================"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Get AWS account and region
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_DEFAULT_REGION:-us-east-1}

echo "📍 Account: $ACCOUNT"
echo "📍 Region: $REGION"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Get deployment parameters
ENVIRONMENT=${1:-test}
GRAPHQL_API_ARN=${2}

echo "🏷️  Environment: $ENVIRONMENT"

if [ -n "$GRAPHQL_API_ARN" ]; then
    echo "🎯 GraphQL API ARN: $GRAPHQL_API_ARN"
    DEPLOY_CMD="cdk deploy -c environment=$ENVIRONMENT -c graphqlApiArn=$GRAPHQL_API_ARN"
else
    echo "🎯 Using test GraphQL API ARN"
    DEPLOY_CMD="cdk deploy -c environment=$ENVIRONMENT"
fi

# Bootstrap CDK if needed
echo "🚀 Checking CDK bootstrap..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $REGION &> /dev/null; then
    echo "📋 Bootstrapping CDK..."
    cdk bootstrap
fi

# Synthesize first to check for errors
echo "🔍 Synthesizing stack..."
cdk synth -c environment=$ENVIRONMENT ${GRAPHQL_API_ARN:+-c graphqlApiArn=$GRAPHQL_API_ARN}

# Deploy
echo "🚀 Deploying WAF..."
eval $DEPLOY_CMD

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Next steps:"
echo "1. Check AWS Console → WAF & Shield → Web ACLs"
echo "2. Look for '$ENVIRONMENT-test-waf' Web ACL"
echo "3. Monitor logs in CloudWatch: /aws/wafv2/appsync/$ENVIRONMENT-waf-logs"
echo "4. Test your GraphQL API to verify protection"
echo ""
echo "🧹 To cleanup: ./cleanup.sh $ENVIRONMENT"
