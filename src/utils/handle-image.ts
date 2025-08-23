import { Readable } from "stream";
import { s3Client } from "./aws";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

export async function s3ImageUpload(file: Express.Multer.File, name: string) {
  // const fileStream = Readable.from(file.buffer);
  const url = await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: name,
      Body: file.buffer,
      ContentLength: file?.size,
      ContentType: file?.mimetype,
    })
  );

  return url;
}

export async function s3ImageDelete(name: string) {
  const url = await s3Client.send(
    new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: name,
    })
  );

  return url;
}
