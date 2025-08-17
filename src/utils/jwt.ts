import jwt from "jsonwebtoken";

export function createToken(id: string, email: string) {
  return jwt.sign({ id, email }, "123");
}

export function validateToken(token: string) {
  return jwt.verify(token, "123");
}
