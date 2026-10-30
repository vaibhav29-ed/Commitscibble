import type { SessionUser } from "@commitscibble/shared";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: SessionUser;
      sessionToken?: string;
    }
  }
}

export {};
