import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: 'admin' | 'user' | 'viewer';
        isRoot: boolean;
        sessionId: number;
      };
    }
  }
}
