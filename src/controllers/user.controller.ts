import { pool } from "db";
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";

export async function createUser(req: Request, res: Response) {
  try {
    const {
      first_name,
      last_name,
      username,
      email,
      password,
      avatar_url,
      cover_url,
    }: {
      first_name: string | undefined;
      last_name: string | undefined;
      username: string | undefined;
      email: string | undefined;
      password: string | undefined;
      avatar_url: string | undefined;
      cover_url: string | undefined;
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

    if (isUserExist.rows.length) {
      res.status(401);
      return res.json({
        msg: "Duplicate records exist",
      });
    }

    const encryptedPassword = await bcrypt.hash(password, 10);

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
        avatar_url || "",
        cover_url || "",
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

export async function getUser(req: Request, res: Response) {
  try {
    
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
    const { id } = req.params;

    if (!id) {
      res.status(404);
      return res.json({
        msg: "Id is missing",
      });
    }

    const isUserDeleted = await pool.query(`DELETE FROM users WHERE id=$1`, [
      id
    ]);

    if (!isUserDeleted.rowCount) {
      res.status(401);
      return res.json({
        msg: "User not found",
      });
    }

    res.status(200);
    return res.json({
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
    const { id } = req.params;
    const {
      first_name,
      last_name,
      avatar_url,
      cover_url,
    }: {
      first_name: string | undefined;
      last_name: string | undefined;
      avatar_url: string | undefined;
      cover_url: string | undefined;
    } = req.body;

    if (!first_name || !last_name || !id) {
      res.status(400);
      return res.json({
        msg: "Missing Credentials",
      });
    }

    const isUserUpdated = await pool.query(
      `UPDATE users SET first_name=$1 last_name=$2 avatar_url=$3 cover_url=$4 WHERE id=$5`,
      [first_name, last_name, avatar_url, cover_url, id]
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
    const { id } = req.params;
    const { password }: { password: string | undefined } = req.body;

    if (!password || !id) {
      res.status(400);
      return res.json({
        msg: "Credentials are missing",
      });
    }

    const encryptedPassword = await bcrypt.hash(password, 10);

    const isPasswordUpdated = await pool.query(
      `UPDATE users SET password=$1 WHERE id=$2`,
      [encryptedPassword, id]
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
