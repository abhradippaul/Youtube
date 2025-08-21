import { pool } from "../db";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { createToken } from "../utils/jwt";
import { v4 as uuidv4 } from "uuid";
import { s3ImageUpload } from "../utils/handle-image";

export async function signupUser(req: Request, res: Response) {
  try {
    const {
      first_name,
      last_name,
      username,
      email,
      password,
    }: {
      first_name: string | undefined;
      last_name: string | undefined;
      username: string | undefined;
      email: string | undefined;
      password: string | undefined;
    } = req.body;

    if (!first_name || !last_name || !username || !email || !password) {
      res.status(404);
      return res.json({
        msg: "Required values are missing",
      });
    }

    const isUserExist = await pool.query(
      `SELECT * FROM users 
  WHERE username = $1 OR email = $2`,
      [username, email]
    );

    if (isUserExist.rowCount) {
      res.status(401);
      return res.json({
        msg: "Duplicate records exist",
      });
    }

    const encryptedPassword = await bcrypt.hash(password, 10);
    let avatar_url = "";
    let cover_url = "";

    if (Object.keys(req.files || {}).length) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (Object.keys(files["avatar_url"] || {}).length) {
        avatar_url = `avatar/${username}-${Date.now()}`;
        const isAvatarUploaded = await s3ImageUpload(
          files["avatar_url"][0],
          avatar_url
        );
        if (isAvatarUploaded.$metadata.httpStatusCode != 200) {
          console.error("Error uploading avatar:", isAvatarUploaded);
          return res.status(400).json({ msg: "Failed to upload avatar" });
        }
      }

      if (Object.keys(files["cover_url"] || {}).length) {
        cover_url = `cover/${username}-${Date.now()}`;
        const isCoverUploaded = await s3ImageUpload(
          files["cover_url"][0],
          cover_url
        );

        if (isCoverUploaded.$metadata.httpStatusCode != 200) {
          console.error("Error uploading cover:", isCoverUploaded);
          return res.status(400).json({ msg: "Failed to upload cover" });
        }
      }
    }

    const isUserCreated = await pool.query(
      `
      INSERT INTO users (
        id, first_name, last_name, username, email, password, avatar_url, cover_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `,
      [
        uuidv4(),
        first_name,
        last_name,
        username,
        email,
        encryptedPassword,
        avatar_url,
        cover_url,
      ]
    );

    if (!isUserCreated?.rows[0]) {
      res.status(404);
      return res.json({
        msg: "User creation failed",
      });
    }

    res.status(201);

    return res.json({
      msg: "User created successfully",
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

export async function loginUser(req: Request, res: Response) {
  try {
    const {
      username,
      password,
    }: { username: string | undefined; password: string | undefined } =
      req.body;

    if (!username || !password) {
      res.status(400);
      return res.json({
        msg: "User created successfully",
      });
    }

    const isUserExist = await pool.query(
      `SELECT * FROM users WHERE username=$1`,
      [username]
    );

    if (!isUserExist.rows[0].id) {
      res.status(400);
      return res.json({
        msg: "User not found",
      });
    }

    const isUserValid = await bcrypt.compare(
      password,
      isUserExist.rows[0].password
    );

    if (!isUserValid) {
      res.status(400);
      return res.json({
        msg: "User is not valid",
      });
    }

    const accessToken = createToken(
      isUserExist.rows[0].id,
      isUserExist.rows[0].username
    );

    res.status(200);
    res.cookie("user-auth", accessToken, {
      secure: true,
    });
    return res.json({
      msg: "User login successfully",
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

export async function logoutUser(req: Request, res: Response) {
  try {
    res.status(200);
    res.clearCookie("user-auth");
    return res.json({
      msg: "User logout successfully",
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
