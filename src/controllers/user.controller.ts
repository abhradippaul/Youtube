import { pool } from "db";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { S3_PREFIX_URL } from "../constants";
import { s3ImageDelete, s3ImageUpload } from "utils/handle-image";

export async function getUser(req: Request, res: Response) {
  try {
    const { id, username } = req.body;

    if (!id || !username) {
      res.status(404);
      return res.json({
        msg: "Id or username is missing",
      });
    }

    const userInfo = await pool.query(
      `SELECT * FROM users WHERE id=$1 AND username=$2;`,
      [id, username]
    );

    const videosInfo = await pool.query(
      `SELECT * FROM videos WHERE owner_id=$1`,
      [id]
    );

    if (!userInfo.rowCount) {
      res.status(401);
      return res.json({
        msg: "User not found",
      });
    }

    res.status(200);
    return res.json({
      msg: "User found successfully",
      userInfo: {
        ...userInfo.rows[0],
        avatar_url: `${
          userInfo.rows[0].avatar_url
            ? S3_PREFIX_URL + userInfo.rows[0].avatar_url
            : ""
        }`,
        cover_url: `${
          userInfo.rows[0].cover_url
            ? S3_PREFIX_URL + userInfo.rows[0].cover_url
            : ""
        }`,
      },
      videosInfo: videosInfo.rows,
    });
  } catch (err) {
    res.status(500);
    console.log(err);
    return res.json({
      msg: "Some thing went wrong",
      error: err,
    });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const { id, username } = req.body;

    if (!id || !username) {
      res.status(404);
      return res.json({
        msg: "Id or username is missing",
      });
    }

    const isUserDeleted = await pool.query(
      `DELETE FROM users WHERE id=$1 AND username=$2 RETURNING *`,
      [id, username]
    );

    if (!isUserDeleted.rowCount) {
      res.status(401);
      return res.json({
        msg: "User not found",
      });
    }

    if (isUserDeleted.rows[0].avatar_url) {
      const isAvatarDeleted = await s3ImageDelete(
        isUserDeleted.rows[0].avatar_url
      );
      if (isAvatarDeleted.$metadata.httpStatusCode != 200) {
        console.error("Error deleting avatar:", isAvatarDeleted);
      }
    }

    if (isUserDeleted.rows[0].cover_url) {
      const isCoverDeleted = await s3ImageDelete(
        isUserDeleted.rows[0].cover_url
      );
      if (isCoverDeleted.$metadata.httpStatusCode != 200) {
        console.error("Error deleting cover:", isCoverDeleted);
      }
    }

    return res.status(200).clearCookie("user-auth").json({
      msg: "User deleted successfully",
    });
  } catch (err) {
    res.status(500);
    console.log(err);
    return res.json({
      msg: "Some thing went wrong",
      error: err,
    });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const { id, username } = req.body;
    const {
      first_name,
      last_name,
    }: {
      first_name: string | undefined;
      last_name: string | undefined;
    } = req.body;

    if (!first_name || !last_name || !id || !username) {
      res.status(400);
      return res.json({
        msg: "Missing Credentials",
      });
    }

    const isUserUpdated = await pool.query(
      `UPDATE users SET first_name=$1, last_name=$2 WHERE id=$3 AND username=$4`,
      [first_name, last_name, id, username]
    );

    if (!isUserUpdated.rowCount) {
      res.status(400);
      return res.json({
        msg: "User update unsuccessfull",
      });
    }

    res.status(200);
    return res.json({
      msg: "User update successfully",
    });
  } catch (err) {
    res.status(500);
    console.log(err);
    return res.json({
      msg: "Some thing went wrong",
      error: err,
    });
  }
}

export async function updatePassword(req: Request, res: Response) {
  try {
    const { id, username } = req.body;
    const { password }: { password: string | undefined } = req.body;

    if (!password || !id || !username) {
      res.status(400);
      return res.json({
        msg: "Credentials are missing",
      });
    }

    const encryptedPassword = await bcrypt.hash(password, 10);

    const isPasswordUpdated = await pool.query(
      `UPDATE users SET password=$1 WHERE id=$2 AND username=$3`,
      [encryptedPassword, id, username]
    );

    if (!isPasswordUpdated.rowCount) {
      res.status(400);
      return res.json({
        msg: "User password update unsuccessfully",
      });
    }

    res.status(202);
    return res.json({
      msg: "Password updated successfully",
    });
  } catch (err) {
    res.status(500);
    console.log(err);
    return res.json({
      msg: "Some thing went wrong",
      error: err,
    });
  }
}

export async function updateAvatar(req: Request, res: Response) {
  try {
    const { id, username } = req.body;

    if (!id || !username) {
      res.status(400);
      return res.json({
        msg: "Credentials are missing",
      });
    }

    if (!req.file) {
      res.status(400);
      return res.json({
        msg: "No file uploaded",
      });
    }

    const avatar_url = `avatar/${username}-${Date.now()}`;
    const isAvatarUploaded = await s3ImageUpload(req?.file, avatar_url);
    if (isAvatarUploaded.$metadata.httpStatusCode != 200) {
      console.error("Error uploading avatar:", isAvatarUploaded);
      return res.status(400).json({ msg: "Failed to upload avatar" });
    }

    const isAvatarUpdated = await pool.query(
      `UPDATE users SET avatar_url=$1 WHERE id=$2 AND username=$3 RETURNING avatar_url`,
      [avatar_url, id, username]
    );

    if (!isAvatarUpdated.rowCount) {
      res.status(400);
      return res.json({
        msg: "User avatar update unsuccessfully",
      });
    }

    const isAvatarDeleted = await s3ImageDelete(
      isAvatarUpdated.rows[0].avatar_url
    );
    if (isAvatarDeleted.$metadata.httpStatusCode != 200) {
      console.error("Error deleting avatar:", isAvatarDeleted);
    }

    res.status(202);
    return res.json({
      msg: "Avatar updated successfully",
    });
  } catch (err) {
    res.status(500);
    console.log(err);
    return res.json({
      msg: "Some thing went wrong",
      error: err,
    });
  }
}

export async function updateCover(req: Request, res: Response) {
  try {
    const { id, username } = req.body;

    if (!id || !username) {
      res.status(400);
      return res.json({
        msg: "Credentials are missing",
      });
    }

    if (!req.file) {
      res.status(400);
      return res.json({
        msg: "No file uploaded",
      });
    }

    const cover_url = `cover/${username}-${Date.now()}`;
    const isCoverUploaded = await s3ImageUpload(req?.file, cover_url);
    if (isCoverUploaded.$metadata.httpStatusCode != 200) {
      console.error("Error uploading cover:", isCoverUploaded);
      return res.status(400).json({ msg: "Failed to upload cover" });
    }

    const isCoverUpdated = await pool.query(
      `UPDATE users SET cover_url=$1 WHERE id=$2 AND username=$3 RETURNING cover_url`,
      [cover_url, id, username]
    );

    if (!isCoverUpdated.rowCount) {
      res.status(400);
      return res.json({
        msg: "User cover update unsuccessfully",
      });
    }

    const isCoverDeleted = await s3ImageDelete(
      isCoverUpdated.rows[0].cover_url
    );
    if (isCoverDeleted.$metadata.httpStatusCode != 200) {
      console.error("Error deleting cover:", isCoverDeleted);
    }

    res.status(202);
    return res.json({
      msg: "Cover updated successfully",
    });
  } catch (err) {
    res.status(500);
    console.log(err);
    return res.json({
      msg: "Some thing went wrong",
      error: err,
    });
  }
}
