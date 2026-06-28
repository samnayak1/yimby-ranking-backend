import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Request, Response, NextFunction } from 'express';
import { createError } from '../utils/errorHelper';


//attach to payload
export interface AuthenticatedUser {
  sub: string;
  email: string;
  groups: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  clientId:   process.env.COGNITO_CLIENT_ID!,
  tokenUse:   'access',
});

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw createError(401, 'Missing token');

    const token = header.slice(7);
    const payload = await verifier.verify(token);

    req.user = {
      sub:    payload.sub,
      email:  payload.email as string ?? '',
      groups: (payload['cognito:groups'] as string[]) ?? [],
    };

    next();
  } catch (err: any) {
    next(err.status ? err : createError(401, 'Invalid or expired token'));
  }
}


export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user?.groups.includes('admins')) {
    return next(createError(403, 'Admin access required'));
  }
  next();
}