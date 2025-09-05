#!/usr/bin/env node
import 'source-map-support/register'
import { App, Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { SimpleWAF } from './lib/SimpleWAF'

interface TestWAFStackProps extends StackProps {
  environment: string
  graphqlApiArn?: string
}

class TestWAFStack extends Stack {
  constructor(scope: Construct, id: string, props: TestWAFStackProps) {
    super(scope, id, props)

    const { environment, graphqlApiArn } = props

    // Use provided ARN or create a test ARN
    const testApiArn = graphqlApiArn || 
      `arn:aws:appsync:${this.region}:${this.account}:apis/test-api-${environment}`

    new SimpleWAF(this, 'SimpleWAF', {
      graphqlApiArn: testApiArn,
      environment,
    })
  }
}

const app = new App()

// Get environment from context or default to 'test'
const environment = app.node.tryGetContext('environment') || 'test'
const graphqlApiArn = app.node.tryGetContext('graphqlApiArn')

new TestWAFStack(app, `tmb12-waf-${environment}`, {
  environment,
  graphqlApiArn,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
})

app.synth()
