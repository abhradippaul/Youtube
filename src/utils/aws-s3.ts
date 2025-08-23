import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./aws";

export async function getS3SignedUrl(key: string) {
  const getObjectParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  };
  const command = new GetObjectCommand(getObjectParams);
  return await getSignedUrl(s3Client, command, { expiresIn: 36000 });
}
