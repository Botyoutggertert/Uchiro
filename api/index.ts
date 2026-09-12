import app from '../server';
import type { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  // Ensure that /api prefix is preserved for Express router if stripped by a serverless rewrite
  if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/api/')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
}
