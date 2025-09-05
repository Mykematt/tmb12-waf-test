#!/bin/bash

# TMB-12 WAF Test Cleanup Script
set -e

echo "🧹 TMB-12 WAF Test Cleanup"
echo "=========================="

ENVIRONMENT=${1:-test}
STACK_NAME="tmb12-waf-$ENVIRONMENT"

echo "🏷️  Environment: $ENVIRONMENT"
echo "📦 Stack: $STACK_NAME"

# Check if stack exists
if aws cloudformation describe-stacks --stack-name $STACK_NAME &> /dev/null; then
    echo "🔍 Found stack $STACK_NAME"
    
    # Show what will be destroyed
    echo "📋 Resources to be destroyed:"
    cdk destroy $STACK_NAME --dry-run
    
    # Confirm destruction
    read -p "❓ Are you sure you want to destroy the WAF test stack? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "💥 Destroying stack..."
        cdk destroy $STACK_NAME --force
        echo "✅ Stack destroyed successfully!"
    else
        echo "❌ Cleanup cancelled"
        exit 0
    fi
else
    echo "❌ Stack $STACK_NAME not found"
    exit 1
fi

echo ""
echo "🎉 Cleanup complete!"
echo ""
echo "📝 Note: S3 buckets with content may need manual deletion"
echo "📝 CloudWatch logs will be automatically deleted based on retention policy"
