import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./aws";
import fs from "fs";

export async function s3VideoUpload(
  file: Express.Multer.File,
  name: string,
  path: string
) {
  const fileStream = fs.createReadStream(path);
  const stats = fs.statSync(path);
  const url = await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: name,
      Body: fileStream,
      ContentLength: stats.size,
      ContentType: file?.mimetype,
    })
  );

  return url;
}

export async function s3VideoDelete(name: string) {
  const url = await s3Client.send(
    new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: name,
    })
  );

  return url;
}
