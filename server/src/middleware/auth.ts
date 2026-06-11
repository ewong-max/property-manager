import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-auth-token'] || req.cookies?.token;
  if (token === process.env.PIN) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorised' });
}
