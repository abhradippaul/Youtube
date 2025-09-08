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
        v.created_at AS video_createdat, 
        u.full_name AS user_fullname, 
        u.username AS username, 
        u.avatar_url AS user_avatarurl
        FROM videos v 
        JOIN users u ON v.owner_id = u.id 
        WHERE v.id = $1;`,
        [videoId]
      );

      if (!video.rowCount) {
        return res.status(404).json({ msg: "Video not found" });
      }

      videoInfo = video.rows[0];
      // await createRedisKey(
      //   `video:${videoId}`,
      //   600,
      //   JSON.stringify(videoInfo)
      // );
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
    const { id: userId } = req.body;

    if (!videoId || !userId) {
      return res.status(400).json({ msg: "Missing video or user id" });
    }

    let responseDDB;
    const isViewsExist = await pool.query(
      `WITH 
      latest_view AS (
      SELECT *, 
      EXTRACT(MINUTES FROM AGE(CURRENT_TIMESTAMP, created_at)) AS age_min
      FROM views WHERE video_id = $1 AND user_id = $2 
      ORDER BY created_at DESC LIMIT 1
      ), 

      video_info AS (
      SELECT views, likes, comments FROM videos 
      WHERE id = $1
      )

      SELECT l.id AS view_id, 
      l.age_min AS age_min, 
      v.views AS video_views,
      v.likes AS video_likes,
      v.comments AS video_comments
      FROM latest_view l 
      FULL JOIN video_info v ON true
      `,
      [videoId, userId]
    );

    if (isViewsExist?.rowCount && isViewsExist?.rows[0]?.age_min > 1) {
      const isViewCreated = await pool.query(
        `INSERT INTO views(id, user_id, video_id) VALUES($1, $2, $3)`,
        [uuidv4(), userId, videoId]
      );

      if (!isViewCreated.rowCount) {
        return res.status(500).json({
          msg: "View update unsuccessful",
        });
      }

      const data = await updateVideoViewCountDDB(videoId);
      responseDDB = {
        views_count: data?.Attributes?.views,
        comments_count: data?.Attributes?.comments,
        likes_count: data?.Attributes?.likes,
      };

      await pool.query(
        `UPDATE videos 
        SET views = $1, comments = $2, likes = $3 WHERE id = $4`,
        [
          responseDDB.views_count,
          responseDDB.comments_count,
          responseDDB.likes_count,
          videoId,
        ]
      );
    } else if (isViewsExist?.rowCount && isViewsExist?.rows[0]?.age_min <= 1) {
      responseDDB = {
        views_count: isViewsExist?.rows[0]?.video_views,
        comments_count: isViewsExist?.rows[0]?.video_comments,
        likes_count: isViewsExist?.rows[0]?.video_likes,
      };
    } else {
      const isViewCreated = await pool.query(
        `INSERT INTO views(id, user_id, video_id) VALUES($1, $2, $3)`,
        [uuidv4(), userId, videoId]
      );
      if (!isViewCreated.rowCount) {
        return res.status(500).json({
          msg: "View update unsuccessful",
        });
      }
      const data = await updateVideoViewCountDDB(videoId);
      responseDDB = {
        views_count: data?.Attributes?.views,
        comments_count: data?.Attributes?.comments,
        likes_count: data?.Attributes?.likes,
      };
    }

    // if (isViewsExist?.rowCount && isViewsExist?.rows[0]?.age_hours > 3) {
    //   const isUserUpdated = await pool.query(
    //     `UPDATE users SET views = $1, likes = $2, comments = $3 updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
    //     [
    //       responseDDB.views_count,
    //       responseDDB.likes_count,
    //       responseDDB.comments_count,
    //       userId,
    //     ]
    //   );
    //   if (!isUserUpdated.rowCount) {
    //     return res.status(400).json({
    //       msg: "Database view update failed",
    //     });
    //   }
    // }

    return res.status(200).json({
      video_numbers: isViewsExist.rows[0],
      msg: "Fetched successfully",
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Something went wrong", err: err });
  }
}

export async function getVideoInteraction(req: Request, res: Response) {
  try {
    const { videoId } = req.params;
    const { id: userId = "" } = req.body;

    if (!videoId || !userId) {
      return res.status(400).json({
        msg: "Video id, user id, username are required",
      });
    }

    const isVideoLikedAndSubscribed = await pool.query(
      `WITH
        is_liked AS (
          SELECT EXISTS (
            SELECT 1 FROM likes WHERE user_id = $1 AND video_id = $2
          ) AS value
        ),
        subscription AS (
          SELECT id FROM subscriptions WHERE user_id = $1 AND channel_id = $1 LIMIT 1
        ),
        is_subscribed AS (
          SELECT EXISTS (
            SELECT 1 FROM subscription
          ) AS value
        )
      SELECT
        is_liked.value AS is_liked,
        is_subscribed.value AS is_subscribed,
        subscription.id AS subscription_id
      FROM is_liked
      LEFT JOIN subscription ON TRUE
      CROSS JOIN is_subscribed;
      `,
      [userId, videoId]
    );

    return res.status(200).json({
      msg: "Like and subscribed successfully fetched",
      ...isVideoLikedAndSubscribed.rows[0],
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Something went wrong", err: err });
  }
}

export async function getVideoComments(req: Request, res: Response) {
  try {
    const { videoId } = req.params;
    const { page = 0, limit = 5 } = req.query;

    if (!videoId) {
      return res.status(400).json({ msg: "Missing video id" });
    }

    let videoComments;
    const OFFSET = Number(page) * Number(limit);
    const COMMENT_LIMIT = (Number(page) + 1) * Number(limit);
    const videoCommentsStr = await getRedisKey(
      `video:${videoId}:comments_page=${COMMENT_LIMIT}`
    );

    if (videoCommentsStr) {
      console.log("Cache hit");
      videoComments = JSON.parse(videoCommentsStr);
    } else {
      videoComments = await pool.query(
        `SELECT  
      c.id AS comment_id,
      c.description AS comment_description,
      c.created_at AS comment_created,
      u.username AS commenter_username,
      u.avatar_url AS commenter_avatarurl,
      u.id AS commenter_id
      FROM comments c 
      JOIN videos v ON c.video_id = v.id
      JOIN users u ON v.owner_id = u.id 
      WHERE c.video_id = $1 ORDER BY c.created_at DESC 
      LIMIT $3 OFFSET $2;`,
        [videoId, OFFSET, COMMENT_LIMIT]
      );

      if (videoComments.rowCount) {
        await createRedisKey(
          `video:${videoId}:comments_page=${COMMENT_LIMIT}`,
          120,
          JSON.stringify(videoComments)
        );
      }
    }

    return res.status(200).json({
      msg: "Fetched video engagement successfully",
      page,
      limit,
      videoComments: videoComments.rows,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Something went wrong", error: err });
  }
}

export async function getVideoHistory(req: Request, res: Response) {
  try {
    const { id: userId } = req.body;
    const { page = 0, limit = 5 } = req.query;

    if (!userId) {
      return res.status(400).json({ msg: "Missing user id" });
    }

    const OFFSET = Number(page) * Number(limit);
    const COMMENT_LIMIT = (Number(page) + 1) * Number(limit);
    let videoHistory;
    const videoHistoryStr = await getRedisKey(
      `user:${userId}:video-history_page=${COMMENT_LIMIT}`
    );

    if (videoHistoryStr) {
      console.log("Cache hit");
      videoHistory = JSON.parse(videoHistoryStr);
    } else {
      const data = await pool.query(
        `SELECT 
        v.id AS video_id, 
        v.title AS video_title, 
        v.thumbnail AS video_thumbnail,
        u.full_name AS user_fullname,
        v.owner_id AS user_id
        FROM views w 
        JOIN videos v ON w.video_id = v.id 
        JOIN users u ON u.id = v.owner_id 
        WHERE w.user_id = $1 ORDER BY w.created_at DESC
        LIMIT $3 OFFSET $2;`,
        [userId, OFFSET, COMMENT_LIMIT]
      );
      videoHistory = data.rows;
      if (data.rowCount) {
        await createRedisKey(
          `user:${userId}:video-history_page=${COMMENT_LIMIT}`,
          600,
          JSON.stringify(videoHistory)
        );
      }
    }

    return res.status(200).json({
      msg: "Fetched video history successfully",
      page,
      limit,
      video_history: videoHistory,
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
