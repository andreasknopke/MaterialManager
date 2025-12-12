import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        email: string;
        fullName?: string;
        role: 'admin' | 'user' | 'viewer';
        isRoot: boolean;
        departmentId: number | null;
        sessionId?: number;
      };
    }
  }
}
