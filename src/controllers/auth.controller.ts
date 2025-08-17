import { pool } from "db";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { createToken } from "utils/jwt";

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
      signed: true,
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
