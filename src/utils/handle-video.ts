import fs from "fs";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./aws";
import { ddbClient } from "../utils/aws";

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

export async function getVideoDDB(videoId: string) {
  return await ddbClient
    .get({
      TableName: "video_info",
      Key: {
        video_id: videoId,
      },
    })
    .promise();
}

export async function createVideoDDB(videoId: string) {
  ddbClient.put(
    {
      TableName: "video_info",
      Item: {
        video_id: videoId,
        views: 0,
        likes: 0,
        comments: 0,
        last_checked: `${new Date()}`,
      },
    },
    (err, data) => {
      if (err) {
        console.error("Error updating item:", JSON.stringify(err, null, 2));
      } else {
        console.log(
          "Item updated successfully:",
          JSON.stringify(data, null, 2)
        );
      }
    }
  );
}

export async function updateVideoViewCountDDB(videoId: string) {
  return await ddbClient
    .update({
      TableName: "video_info",
      Key: {
        video_id: videoId,
      },
      UpdateExpression: "SET #attr1 = if_not_exists(#attr1, :start) + :inc",
      ExpressionAttributeNames: {
        "#attr1": "views",
      },
      ExpressionAttributeValues: {
        ":inc": 1,
        ":start": 0,
      },
      ReturnValues: "ALL_NEW",
    })
    .promise();
  // ddbClient.update(
  //   {
  //     TableName: "video_info",
  //     Key: {
  //       video_id: videoId,
  //     },
  //     UpdateExpression: "SET #attr1 = if_not_exists(#attr1, :start) + :inc",
  //     ExpressionAttributeNames: {
  //       "#attr1": "views",
  //     },
  //     ExpressionAttributeValues: {
  //       ":inc": 1,
  //       ":start": 0,
  //     },
  //     ReturnValues: "ALL_NEW",
  //   },
  //   (err, data) => {
  //     if (err) {
  //       console.error("Error updating item:", JSON.stringify(err, null, 2));
  //     } else {
  //       console.log(
  //         "Item updated successfully:"
  //         // JSON.stringify(data, null, 2)
  //       );
  //       console.log(data);
  //       views = data?.Attributes?.views;
  //     }
  //   }
  // );
  // return views;
}

export async function incrementCommentCountDDB(videoId: string) {
  return await ddbClient
    .update({
      TableName: "video_info",
      Key: {
        video_id: videoId,
      },
      UpdateExpression: "SET #attr1 = if_not_exists(#attr1, :start) + :inc",
      ExpressionAttributeNames: {
        "#attr1": "comments",
      },
      ExpressionAttributeValues: {
        ":inc": 1,
        ":start": 0,
      },
    })
    .promise();
}

export async function decrementCommentCountDDB(videoId: string) {
  return await ddbClient
    .update({
      TableName: "video_info",
      Key: {
        video_id: videoId,
      },
      UpdateExpression: "SET #attr1 = if_not_exists(#attr1, :start) + :dec",
      ExpressionAttributeNames: {
        "#attr1": "comments",
      },
      ExpressionAttributeValues: {
        ":dec": -1,
        ":start": 0,
      },
    })
    .promise();
}

export async function incrementLikeCountDDB(videoId: string) {
  return await ddbClient
    .update({
      TableName: "video_info",
      Key: {
        video_id: videoId,
      },
      UpdateExpression: "SET #attr1 = if_not_exists(#attr1, :start) + :inc",
      ExpressionAttributeNames: {
        "#attr1": "likes",
      },
      ExpressionAttributeValues: {
        ":inc": 1,
        ":start": 0,
      },
    })
    .promise();
}

export async function decrementLikeCountDDB(videoId: string) {
  return await ddbClient
    .update({
      TableName: "video_info",
      Key: {
        video_id: videoId,
      },
      UpdateExpression: "SET #attr1 = if_not_exists(#attr1, :start) + :dec",
      ExpressionAttributeNames: {
        "#attr1": "likes",
      },
      ExpressionAttributeValues: {
        ":dec": -1,
        ":start": 0,
      },
    })
    .promise();
}
