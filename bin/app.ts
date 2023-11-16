#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { S3BucketStack } from '../lib/s3-bucket-stack';
import { CloudFrontStack } from '../lib/cloudfront-stack';

const app = new cdk.App();

// Create the S3BucketStack
const s3BucketStack = new S3BucketStack(app, 'S3BucketStack', {
  stackName: 'CohortS3BucketStack' 

});

// Create the CloudFrontStack
new CloudFrontStack(s3BucketStack, 'CloudFrontStack', {
  bucket: s3BucketStack.bucket,
  stackName: 'CohortCloudFrontStack' 
});
