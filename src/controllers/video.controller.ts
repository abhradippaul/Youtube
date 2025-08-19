import { pool } from "db";
import { Request, Response } from "express";
import { s3VideoUpload } from "utils/handle-video";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { S3_PREFIX_URL } from "../constants";
import { s3ImageUpload } from "utils/handle-image";
import { sendMail } from "utils/resend";

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

    const videoUrl = `videos/${isUserExist.rows[0].username}/${
      files.video[0].originalname
    }-${Date.now()}`;

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

    let thumbnailUrl = "";

    if (files.thumbnail && files.thumbnail.length) {
      thumbnailUrl = `thumbnails/${isUserExist.rows[0].username}/${
        files.thumbnail[0].originalname
      }-${Date.now()}`;

      const isThumbnailUploaded = await s3VideoUpload(
        files.thumbnail[0],
        thumbnailUrl,
        files.video[0].path
      );

      if (isThumbnailUploaded.$metadata.httpStatusCode !== 200) {
        return res.status(500).json({
          msg: "Error uploading thumbnail",
          error: isThumbnailUploaded,
        });
      }
    }

    const isVideoCreated = await pool.query(
      `INSERT INTO videos (id, owner_id, title, description, video_url, thumbnail) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`,
      [uuidv4(), id, title, description, videoUrl, thumbnailUrl]
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
    if (!id) {
      return res.status(400).json({ msg: "Missing video id" });
    }

    const video = await pool.query(
      `SELECT * FROM videos LEFT JOIN users ON videos.owner_id=users.id WHERE videos.id = $1;`,
      [id]
    );

    if (!video.rowCount) {
      return res.status(404).json({ msg: "Video not found" });
    }

    // const error = await sendMail(
    //   "abhradipserampore@gmail.com",
    //   "Your video has been uploaded",
    //   "Thank you for uploading your video!"
    // );

    // if (error) {
    //   return res.status(500).json({ msg: "Error sending email", error });
    // }

    return res.status(200).json({
      video: {
        ...video.rows[0],
        thumbnail: `${
          video.rows[0].thumbnail
            ? `${S3_PREFIX_URL}${video.rows[0].thumbnail}`
            : ""
        }`,
        video_url: `${S3_PREFIX_URL}${video.rows[0].video_url}`,
        cover_url: `${
          video.rows[0].cover_url
            ? `${S3_PREFIX_URL}${video.rows[0].cover_url}`
            : ""
        }`,
        avatar_url: `${
          video.rows[0].avatar_url
            ? `${S3_PREFIX_URL}${video.rows[0].avatar_url}`
            : ""
        }`,
      },
    });
  } catch (err) {
    return res.status(500).json({ msg: "Something went wrong", error: err });
  }
}

export async function getVideos(req: Request, res: Response) {
  try {
    const videos = await pool.query(
      `SELECT * FROM videos LEFT JOIN users ON videos.owner_id=users.id`
    );

    return res
      .status(200)
      .json({ videoCount: videos.rowCount, videos: videos.rows });
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
      `SELECT * FROM videos JOIN users ON videos.owner_id=users.id WHERE videos.id = $1 AND users.username = $2 AND users.id = $3`,
      [videoId, username, id]
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

    return res.status(200).json({ msg: "Thumbnail updated successfully" });
  } catch (err) {
    return res.status(500).json({ msg: "Something went wrong", err });
  }
}
