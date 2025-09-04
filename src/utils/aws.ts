import { S3Client } from "@aws-sdk/client-s3";
import AWS from "aws-sdk";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!, // Specify the AWS region from environment variables
  credentials: {
    accessKeyId: process.env.AWS_ACCESSKEYID!, // Access key ID from environment variables
    secretAccessKey: process.env.AWS_SECRETACCESSKEY!, // Secret access key from environment variables
  },
});

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESSKEYID!,
  secretAccessKey: process.env.AWS_SECRETACCESSKEY!,
  region: process.env.AWS_REGION!,
});

const sesClient = new AWS.SES({ apiVersion: "2010-12-01" });
const ddbClient = new AWS.DynamoDB.DocumentClient({ apiVersion: "2012-08-10" });

export { s3Client, sesClient, ddbClient };
