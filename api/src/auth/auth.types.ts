import type { Request } from 'express';
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'customer' | 'provider';
  companyId: string | null;
  companyName: string | null;
}
export interface AuthenticatedRequest extends Request {
  user: User;
  sessionHash: string;
  csrfToken: string;
  requestId?: string;
}
