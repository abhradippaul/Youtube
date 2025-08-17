import { pool } from "db";
import { Request, Response } from "express";
import bcrypt from "bcrypt";

export async function getUser(req: Request, res: Response) {
  try {
    const { id, username } = req.body;

    const userInfo = await pool.query(
      `SELECT * FROM users WHERE id=$1 AND username=$2`,
      [id, username]
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
      userInfo: userInfo.rows[0],
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
    const { id } = req.params;

    if (!id) {
      res.status(404);
      return res.json({
        msg: "Id is missing",
      });
    }

    const isUserDeleted = await pool.query(`DELETE FROM users WHERE id=$1`, [
      id,
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
