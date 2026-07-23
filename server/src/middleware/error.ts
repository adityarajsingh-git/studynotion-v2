import { Request, Response, NextFunction } from "express";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: "Route not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  const status = err.name === "ValidationError" ? 400 : 500;
  res.status(status).json({ success: false, message: err.message || "Server error" });
}
