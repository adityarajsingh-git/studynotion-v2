import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface TokenPayload {
  id: string;
  role: "student" | "instructor";
}

export const signToken = (payload: TokenPayload): string =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" });

export const verifyToken = (token: string): TokenPayload =>
  jwt.verify(token, env.jwtSecret) as TokenPayload;
