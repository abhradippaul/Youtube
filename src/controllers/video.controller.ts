import { pool } from "db";
import { Request, Response } from "express";
import { s3VideoUpload } from "utils/handle-video";
import fs from "fs";

export async function uploadVideo(req: Request, res: Response) {
  try {
    const { id, username } = req.body;
    if (!id || !username) {
      return res.status(400).json({ msg: "Missing id or username" });
    }

    if (!req.file) {
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
      req.file.originalname
    }-${Date.now()}`;

    const url = await s3VideoUpload(req.file, videoUrl, req.file.path);

    if (url.$metadata.httpStatusCode !== 200) {
      return res.status(500).json({ msg: "Error uploading video", error: url });
    }

    fs.unlink(req.file.path, (err) => {
      if (err) {
        console.error("Error deleting video file:", err);
      }
    });

    return res.status(200).json({ msg: "Video uploaded successfully" });
  } catch (err) {
    return res.status(500).json({ msg: "Something went wrong", error: err });
  }
}
