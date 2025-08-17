import jwt from "jsonwebtoken";

export function createToken(id: string, username: string) {
  return jwt.sign({ id, username }, "123");
}

export function validateToken(token: string) {
  return jwt.verify(token, "123");
}
