import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { AppError, ERROR_CODES, type ApiErrorBody } from "@commitscibble/shared";

export function sendOk<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data, requestId: res.locals.requestId ?? requestIdOf(res) });
}

export function sendError(res: Response, error: AppError): void {
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
    requestId: res.locals.requestId ?? requestIdOf(res),
  };
  res.status(error.httpStatus).json(body);
}

function requestIdOf(res: Response): string {
  return (res.req as Request).requestId ?? "unknown";
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function parseWith<T extends ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  try {
    return schema.parse(value) as z.infer<T>;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, "Request validation failed", {
        httpStatus: 422,
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    throw error;
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(
    res,
    new AppError(ERROR_CODES.NOT_FOUND, `No route matches ${req.method} ${req.path}`, {
      httpStatus: 404,
    }),
  );
}
