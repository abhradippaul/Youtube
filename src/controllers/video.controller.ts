import fs from "fs";
import { pool } from "../db";
import { Request, Response } from "express";
import {
  createVideoDDB,
  getVideoDDB,
  s3VideoDelete,
  s3VideoUpload,
  updateVideoViewCountDDB,
} from "../utils/handle-video";
import { v4 as uuidv4 } from "uuid";
import { s3ImageDelete, s3ImageUpload } from "../utils/handle-image";
import { sendMail } from "../utils/resend";
import { getS3SignedUrl } from "../utils/aws-s3";
import { createRedisKey, deleteRedisKey, getRedisKey } from "../utils/redis";

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

    if (!isUserExist.rowCount) {
      return res.status(404).json({ msg: "User not found" });
    }

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

    await createVideoDDB(isVideoCreated.rows[0].id);

    return res.status(200).json({
      msg: "Video uploaded successfully",
      video: isVideoCreated.rows[0],
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Something went wrong", error: err });
  }
}

export async function getVideo(req: Request, res: Response) {
  try {
    const { videoId } = req.params;

    if (!videoId) {
      return res.status(400).json({ msg: "Missing video id" });
    }

    let videoInfoStr = await getRedisKey(`video:${videoId}`);
    let videoInfo;

    if (videoInfoStr) {
      console.log("Cache hit");
      videoInfo = JSON.parse(videoInfoStr);
    } else {
      console.log("Database call for video in else");
      const video = await pool.query(
        `SELECT 
        v.title AS video_title,
        v.description AS video_description,
        v.video_url AS video_url,
        v.thumbnail AS video_thumbnail,
        v.created_at AS video_created_at, 
        u.full_name AS full_name, 
        u.username AS username, 
        u.avatar_url AS avatar_url 
        FROM videos v 
        JOIN users u ON v.owner_id = u.id 
        WHERE v.id = $1;`,
        [videoId]
      );

      if (!video.rowCount) {
        return res.status(404).json({ msg: "Video not found" });
      }

      videoInfo = video.rows[0];
      await createRedisKey(
        `video:${videoId}`,
        60 * 10,
        JSON.stringify(videoInfo)
      );
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

export async function getVideoNumbers(req: Request, res: Response) {
  try {
    const { videoId } = req.params;

    if (!videoId) {
      return res.status(400).json({ msg: "Missing video id" });
    }

    const responseDDB = await updateVideoViewCountDDB(videoId);

    return res.status(200).json({
      views_count: responseDDB?.Attributes?.views,
      comments_count: responseDDB?.Attributes?.comments,
      likes_count: responseDDB?.Attributes?.likes,
      msg: "Fetched successfully",
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Something went wrong", err: err });
  }
}

export async function getVideoEngagement(req: Request, res: Response) {
  try {
    const { videoId } = req.params;
    const { id: userId = "" } = req.body;

    if (!videoId) {
      return res.status(400).json({ msg: "Missing video id" });
    }

    const videoEngagement = await pool.query(
      `SELECT 
        json_agg(
            JSON_BUILD_OBJECT(
                'id', c.id,
                'description', c.description
            )
        ) AS comments,
        COUNT(c.*) AS comments_count,
        (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id) AS likes_count,
        EXISTS (
        SELECT 1 FROM likes l WHERE l.video_id = v.id AND l.user_id = $2
        ) AS isLiked
        FROM videos v
        LEFT JOIN comments c ON v.id = c.video_id
        WHERE v.id = $1
        GROUP BY v.id;
        `,
      [videoId, userId]
    );

    return res.status(200).json({
      msg: "Fetched video engagement successfully",
      videoEngagement: videoEngagement.rows,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Something went wrong", error: err });
  }
}

export async function getVideos(req: Request, res: Response) {
  try {
    const videos = await pool.query(
      `SELECT 
      v.id AS video_id, 
      v.title AS video_title, 
      v.thumbnail AS video_thumbnail,
      EXTRACT(DAY FROM AGE(CURRENT_TIMESTAMP, v.created_at)) AS video_age,
      u.full_name AS user_fullname,
      u.avatar_url AS user_avatarurl
      FROM videos v JOIN users u ON v.owner_id = u.id;`
    );

    return res
      .status(200)
      .json({ msg: "Video fetched successfully", videos: videos.rows });
  } catch (err) {
    console.log(err);
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

    await deleteRedisKey(`video:${videoId}`);

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

    await deleteRedisKey(`video:${videoId}`);

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

    await deleteRedisKey(`video:${videoId}`);

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

    await deleteRedisKey(`video:${videoId}`);

    res.status(200).json({ msg: "Video deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Internal Server Error", err });
  }
}
