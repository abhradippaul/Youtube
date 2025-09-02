import { pool } from "../db";
import { Request, Response } from "express";
import { s3VideoDelete, s3VideoUpload } from "../utils/handle-video";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { S3_PREFIX_URL } from "../constants";
import { s3ImageDelete, s3ImageUpload } from "../utils/handle-image";
import { sendMail } from "../utils/resend";
import { getS3SignedUrl } from "../utils/aws-s3";
import { createRedisKey, getRedisKey } from "../utils/redis";

export async function uploadVideo(req: Request, res: Response) {
  try {
    const { id, username, title, description } = req.body;

    if (!id || !username) {
      return res.status(400).json({ msg: "Missing id or username" });
    }

    if (!title || !description) {
      return res.status(400).json({ msg: "Missing title or description" });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files.video.length) {
      return res.status(400).json({ msg: "No video file uploaded" });
    }

    const isUserExist = await pool.query(
      `SELECT * FROM users WHERE id = $1 AND username = $2`,
      [id, username]
    );

    if (!isUserExist.rows.length) {
      return res.status(404).json({ msg: "User not found" });
    }

    console.log(req.files);

    const videoUrl = `videos/${isUserExist.rows[0].username}/${Date.now()}`;

    const isVideoUploaded = await s3VideoUpload(
      files.video[0],
      videoUrl,
      files.video[0].path
    );

    if (isVideoUploaded.$metadata.httpStatusCode !== 200) {
      return res
        .status(500)
        .json({ msg: "Error uploading video", error: isVideoUploaded });
    }

    const isVideoCreated = await pool.query(
      `INSERT INTO videos (id, owner_id, title, description, video_url, duration) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`,
      [uuidv4(), id, title, description, videoUrl, 123]
    );

    if (!isVideoCreated.rowCount) {
      return res
        .status(500)
        .json({ msg: "Error creating video", error: isVideoCreated });
    }

    fs.unlink(files.video[0].path, (err) => {
      if (err) {
        console.error("Error deleting video file:", err);
      }
    });

    return res.status(200).json({
      msg: "Video uploaded successfully",
      video: isVideoCreated.rows[0],
    });
  } catch (err) {
    return res.status(500).json({ msg: "Something went wrong", error: err });
  }
}

export async function getVideo(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // const { id: userId } = req.body;
    if (!id) {
      return res.status(400).json({ msg: "Missing video id" });
    }
    let videoInfoStr = await getRedisKey(`video:${id}`);
    let videoInfo;

    if (videoInfoStr) {
      videoInfo = JSON.parse(videoInfoStr);
    } else {
      console.log("Database call");
      const video = await pool.query(
        `SELECT JSON_BUILD_OBJECT(
        'id',
        u.id,
        'username',
        u.username,
        'email',
        u.email,
        'avatar_url',
        u.avatar_url
    ) AS user,
    JSON_BUILD_OBJECT(
        'id',
        v.id,
        'title',
        v.title,
        'description',
        v.description,
        'video_url',
        v.video_url,
        'created_at',
        v.created_at
    ) AS video,
    json_agg(
        JSON_BUILD_OBJECT(
            'id',
            c.id,
            'description',
            c.description
        )
    ) AS comments,
    COUNT(c.id) AS total_comments
FROM users u
    JOIN videos v ON u.id = v.owner_id
    JOIN comments c ON v.id = c.video_id
WHERE v.id = $1
GROUP BY u.id,
    v.id;`,
        [id]
      );

      if (!video.rowCount) {
        return res.status(404).json({ msg: "Video not found" });
      }

      videoInfo = video.rows[0];
      await createRedisKey(`video:${id}`, JSON.stringify(videoInfo));
    }

    // const updatedComments = await Promise.all(
    //   video.rows[0].comments.map(async (e: any) => ({
    //     ...e,
    //     avatar_url: await getS3SignedUrl(e.avatar_url),
    //   }))
    // );

    // video.rows[0].comments = updatedComments;
    return res.json({
      videoInfo,
    });

    // return res.status(200).json({
    //   msg: "Video fetched successfully",
    //   video: {
    //     ...video.rows[0].videos,
    //     thumbnail: `${
    //       video.rows[0].videos.thumbnail
    //         ? await getS3SignedUrl(video.rows[0].videos.thumbnail)
    //         : ""
    //     }`,
    //     video_url: await getS3SignedUrl(video.rows[0].videos.video_url),
    //     cover_url: `${
    //       video.rows[0].videos.cover_url
    //         ? await getS3SignedUrl(video.rows[0].videos.cover_url)
    //         : ""
    //     }`,
    //     avatar_url: `${
    //       video.rows[0].videos.avatar_url
    //         ? await getS3SignedUrl(video.rows[0].videos.avatar_url)
    //         : ""
    //     }`,
    //     total_comment: video.rows[0].comments.length,
    //     comments: video.rows[0].comments,
    //   },
    // });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Something went wrong", err: err });
  }
}

export async function getVideos(req: Request, res: Response) {
  try {
    const videos = await pool.query(
      `SELECT u.*, v.*, v.id AS video_id FROM videos v LEFT JOIN users u ON v.owner_id=u.id`
    );

    return res
      .status(200)
      .json({ videoCount: videos.rowCount, videos: videos.rows });
  } catch (err) {
    return res.status(500).json({ msg: "Something went wrong", error: err });
  }
}

export async function uploadThumbnail(req: Request, res: Response) {
  try {
    const { id, username } = req.body;
    const { id: videoId } = req.params;

    if (!id || !username) {
      return res.status(400).json({ msg: "Missing id or username" });
    }

    if (!videoId) {
      return res.status(400).json({ msg: "Missing video id" });
    }

    const isUserAndVideoExist = await pool.query(
      `SELECT * FROM users u JOIN videos v ON u.id = v.owner_id WHERE u.id = $1 AND u.username = $2 AND v.id = $3`,
      [id, username, videoId]
    );

    if (!isUserAndVideoExist.rowCount) {
      return res.status(404).json({ msg: "User or video not found" });
    }

    if (isUserAndVideoExist.rows[0].thumbnail) {
      return res.status(400).json({ msg: "Thumbnail already exists" });
    }

    if (!req.file) {
      return res.status(400).json({ msg: "No thumbnail file uploaded" });
    }

    const thumbnail_url = `thumbnail/${username}/${Date.now()}`;

    const isThumbnailUploaded = await s3ImageUpload(req.file, thumbnail_url);

    if (isThumbnailUploaded.$metadata.httpStatusCode !== 200) {
      return res
        .status(500)
        .json({ msg: "Error uploading thumbnail", error: isThumbnailUploaded });
    }

    const isThumbnailUpdated = await pool.query(
      `UPDATE videos SET thumbnail = $1 WHERE id = $2`,
      [thumbnail_url, videoId]
    );

    if (!isThumbnailUpdated.rowCount) {
      return res
        .status(500)
        .json({ msg: "Error updating thumbnail", error: isThumbnailUpdated });
    }

    return res.status(200).json({
      msg: "Thumbnail uploaded successfully",
    });
  } catch (err) {
    return res.status(500).json({ msg: "Something went wrong", error: err });
  }
}

export async function updateThumbnail(req: Request, res: Response) {
  try {
    const { id: videoId } = req.params;
    const { id, username } = req.body;

    if (!id || !username) {
      return res.status(400).json({ msg: "Missing id or username" });
    }

    if (!videoId) {
      return res.status(400).json({ msg: "Missing video id" });
    }

    const isUserAndVideoExist = await pool.query(
      `SELECT * FROM users u JOIN videos v ON u.id = v.owner_id WHERE u.id = $1 AND u.username = $2 AND v.id = $3`,
      [id, username, videoId]
    );

    if (!isUserAndVideoExist.rowCount) {
      return res.status(404).json({ msg: "User or video not found" });
    }

    if (!req.file) {
      return res.status(400).json({ msg: "Missing thumbnail file" });
    }

    const thumbnail_url = `thumbnail/${username}/${Date.now()}`;

    const isThumbnailUploaded = await s3ImageUpload(req.file, thumbnail_url);

    if (isThumbnailUploaded.$metadata.httpStatusCode !== 200) {
      return res
        .status(500)
        .json({ msg: "Error uploading thumbnail", error: isThumbnailUploaded });
    }

    const isThumbnailUpdated = await pool.query(
      `UPDATE videos SET thumbnail = $1 WHERE id = $2`,
      [thumbnail_url, videoId]
    );

    if (!isThumbnailUpdated.rowCount) {
      return res
        .status(500)
        .json({ msg: "Error updating thumbnail", error: isThumbnailUpdated });
    }

    await s3ImageDelete(isUserAndVideoExist.rows[0].thumbnail);

    // if (isImageDeleted.$metadata.httpStatusCode !== 200) {
    //   return res
    //     .status(500)
    //     .json({ msg: "Error deleting old thumbnail", error: isImageDeleted });
    // }

    return res.status(200).json({ msg: "Thumbnail updated successfully" });
  } catch (err) {
    return res.status(500).json({ msg: "Something went wrong", err });
  }
}

export async function updateVideoInfo(req: Request, res: Response) {
  try {
    const { id: videoId } = req.params;
    const { title, description, id } = req.body;

    if (!id) {
      return res.status(400).json({ msg: "Missing id" });
    }

    if (!videoId || !title || !description) {
      return res
        .status(400)
        .json({ msg: "Missing video id, title or description" });
    }

    const isUserAndVideoExist = await pool.query(
      `SELECT * FROM videos WHERE id = $1 AND owner_id = $2`,
      [videoId, id]
    );

    if (!isUserAndVideoExist.rowCount) {
      return res.status(404).json({ msg: "User or video not found" });
    }

    const isVideoUpdated = await pool.query(
      `UPDATE videos SET title = $1, description = $2 WHERE id = $3`,
      [title, description, videoId]
    );

    if (!isVideoUpdated.rowCount) {
      return res.status(500).json({ msg: "Failed to update video" });
    }

    res.status(200).json({ msg: "Video updated successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Internal Server Error", err });
  }
}

export async function deleteVideo(req: Request, res: Response) {
  try {
    const { id: videoId } = req.params;
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ msg: "Missing id" });
    }

    if (!videoId) {
      return res.status(400).json({ msg: "Missing video id" });
    }

    const isVideoDeleted = await pool.query(
      `DELETE FROM videos WHERE id = $1 AND owner_id = $2 RETURNING *`,
      [videoId, id]
    );

    if (!isVideoDeleted.rowCount) {
      return res.status(500).json({ msg: "Failed to delete video" });
    }

    const isS3ThumbnailDeleted = await s3VideoDelete(
      isVideoDeleted.rows[0].thumbnail
    );

    if (isS3ThumbnailDeleted.$metadata.httpStatusCode !== 200) {
      return res.status(500).json({ msg: "Failed to delete video thumbnail" });
    }

    const isS3VideoDeleted = await s3VideoDelete(
      isVideoDeleted.rows[0].video_url
    );

    if (isS3VideoDeleted.$metadata.httpStatusCode !== 200) {
      return res.status(500).json({ msg: "Failed to delete video file" });
    }

    res.status(200).json({ msg: "Video deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Internal Server Error", err });
  }
}
