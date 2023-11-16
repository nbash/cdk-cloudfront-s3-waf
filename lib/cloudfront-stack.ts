import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Distribution, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { CfnOutput } from 'aws-cdk-lib';
import * as path from 'path';
import { CfnWebACL, CfnIPSet } from 'aws-cdk-lib/aws-wafv2';
import { config } from '../config'; 

interface CloudFrontStackProps extends StackProps {
  bucket: Bucket;
}

export class CloudFrontStack extends Stack {
  public readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: CloudFrontStackProps) {
    super(scope, id, props);

    // Use the allowed IP addresses from config file
    const ipSet = new CfnIPSet(this, 'AllowedIPSet', {
      addresses: config.allowedIPs,
      ipAddressVersion: 'IPV4',
      scope: 'CLOUDFRONT',
    });

    // Create a Web ACL to use the IP set and include AWS Managed Rules
    const webAcl = new CfnWebACL(this, 'WebAcl', {
      defaultAction: {
        block: {} 
      },
      scope: 'CLOUDFRONT',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'webAclMetric',
        sampledRequestsEnabled: true
      },
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 0,
          overrideAction: { none: {} }, 
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            }
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommon',
            sampledRequestsEnabled: true
          }
        },
        {
          name: 'AllowSpecificIPs',
          priority: 1,
          action: {
            allow: {}
          },
          statement: {
            ipSetReferenceStatement: {
              arn: ipSet.attrArn
            }
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'allowedIPs',
            sampledRequestsEnabled: true
          }
        },
      ],
      name: 'RestrictIpsWebACL',
    });

    // Create the CloudFront distribution with the S3 bucket as the origin and associate the Web ACL
    this.distribution = new Distribution(this, 'SiteDistribution', {
      defaultBehavior: {
        origin: new S3Origin(props.bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      webAclId: webAcl.attrArn, 
    });

    // Deploy site contents to the S3 bucket
    new BucketDeployment(this, 'DeployWithInvalidation', {
      sources: [Source.asset(path.join(__dirname, '../frontend'))],
      destinationBucket: props.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
    });

    // Outputs 
    new CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName
    });

  }
}
