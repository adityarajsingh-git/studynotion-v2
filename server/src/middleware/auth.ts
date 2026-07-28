import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../utils/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: TokenPayload; }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: "Not authenticated" });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

/**
 * For PUBLIC routes that render differently for the resource owner — e.g. an
 * instructor previewing their own draft course on GET /courses/:id. Sets
 * req.user when a valid Bearer token is present; an absent, malformed or
 * expired token just means "anonymous viewer", NEVER a 401 — anonymous access
 * is the whole point of the route, and the draft gate downstream answers with
 * the same 404 either way, so nothing about the token leaks course existence.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      // invalid/expired token on a public route → treat as anonymous
    }
  }
  next();
}

export function requireRole(role: "instructor" | "student") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role)
      return res.status(403).json({ success: false, message: `Requires ${role} role` });
    next();
  };
}
