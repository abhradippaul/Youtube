import { NextFunction, Request, Response } from "express";

export async function verifyUserToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const cookie = req.cookies;
  console.log(cookie);
  next();
}
