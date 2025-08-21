import { NextFunction, Request, Response } from "express";
import { validateToken } from "../utils/jwt";

export async function verifyUserToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const cookie = req.cookies;

  if (!cookie["user-auth"]) {
    res.status(404);
    return res.json({
      msg: "Cookie not found",
    });
  }

  const { username, id } = validateToken(cookie["user-auth"]) as {
    id: string;
    username: string;
    iat: number;
  };

  if (!username || !id) {
    res.status(404);
    return res.json({
      msg: "User is unauthenticated",
    });
  }

  req.body = { ...req.body, id, username };
  next();
}
