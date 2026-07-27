import { Request, Response, NextFunction } from "express";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: "Route not found" });
}

/** Mongo/Mongoose failures carry the extra fields we need to map onto HTTP statuses. */
interface DbError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

/**
 * Maps known error shapes onto real status codes. Anything unrecognised is a 500
 * with a generic message — internal details go to the log, never to the client.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: DbError, _req: Request, res: Response, _next: NextFunction) {
  if (err.name === "ValidationError")
    return res.status(400).json({ success: false, message: err.message });

  if (err.name === "CastError")
    return res.status(400).json({ success: false, message: "Malformed id or query parameter" });

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0];
    return res.status(409).json({
      success: false,
      message: field ? `That ${field} is already taken` : "Duplicate value",
    });
  }

  console.error(err);
  return res.status(500).json({ success: false, message: "Server error" });
}
