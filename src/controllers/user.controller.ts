import { pool } from "../db";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { s3ImageDelete, s3ImageUpload } from "../utils/handle-image";
import { createRedisKey, deleteRedisKey, getRedisKey } from "../utils/redis";
import { getS3SignedUrl } from "../utils/aws-s3";

export async function getUser(req: Request, res: Response) {
  try {
    const { id, username } = req.body;

    if (!id || !username) {
      return res.status(400).json({ msg: "Id or username is missing" });
    }

    let userInfoStr = await getRedisKey(`user:${id}`);
    let userInfo;

    if (userInfoStr) {
      console.log("Cache hit");
      userInfo = JSON.parse(userInfoStr);
    } else {
      console.log("Database call");

      const { rows, rowCount } = await pool.query(
        `SELECT 
          u.id AS user_id,
          u.username AS username,
          u.full_name AS user_fullname,
          u.avatar_url AS user_avatarurl,
          u.cover_url AS user_coverurl,
          COALESCE(
              JSON_AGG(
                  JSON_BUILD_OBJECT(
                      'id', v.id,
                      'title', v.title,
                      'description', v.description,
                      'thumbnail', v.thumbnail,
                      'views', v.views,
                      'video_age', EXTRACT(DAY FROM AGE(CURRENT_TIMESTAMP, v.created_at))
                  )
              ) FILTER (WHERE v.id IS NOT NULL), '[]'
          ) AS videos
      FROM users u
      LEFT JOIN videos v ON u.id = v.owner_id
      WHERE u.id = $1 AND u.username = $2
      GROUP BY u.id;`,
        [id, username]
      );

      if (!rowCount) {
        return res.status(404).json({ msg: "User not found" });
      }

      userInfo = rows[0];
      // Cache user for next time
      await createRedisKey(`user:${id}`, 60 * 10, JSON.stringify(userInfo));
    }

    // Fetch user videos (parallelizing improves speed)
    const [avatarUrl, coverUrl] = await Promise.all([
      userInfo.avatar_url
        ? getS3SignedUrl(userInfo.avatar_url)
        : Promise.resolve(""),
      userInfo.cover_url
        ? getS3SignedUrl(userInfo.cover_url)
        : Promise.resolve(""),
    ]);

    return res.status(200).json({
      msg: "User found successfully",
      // userInfo: {
      //   ...userInfo,
      //   avatar_url: avatarUrl,
      //   cover_url: coverUrl,
      // },
      // videosInfo: videosInfo.rows,
      userInfo,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
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

    await deleteRedisKey(`user:${id}`);

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

    await deleteRedisKey(`user:${id}`);

    return res.status(200).json({
      msg: "User update successfully",
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
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

    await deleteRedisKey(`user:${id}`);

    return res.status(202).json({
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

    const isUserDeletedFromRedis = await deleteRedisKey(`user:${id}`);

    if (!isUserDeletedFromRedis) {
      console.error("Error deleting user from Redis");
    }

    await deleteRedisKey(`user:${id}`);

    return res.status(202).json({
      msg: "Avatar updated successfully",
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
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

    const isUserDeletedFromRedis = await deleteRedisKey(`user:${id}`);

    if (!isUserDeletedFromRedis) {
      console.error("Error deleting user from Redis");
    }

    await deleteRedisKey(`user:${id}`);

    return res.status(202).json({
      msg: "Cover updated successfully",
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      msg: "Some thing went wrong",
      error: err,
    });
  }
}
