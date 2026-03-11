import { Request, Response, NextFunction } from 'express';
import { authService } from '../auth/service.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        type: 'human' | 'ai';
        permissions: string[];
      };
      authType?: 'jwt' | 'api_key';
    }
  }
}

/**
 * JWT Authentication Middleware
 * 
 * Verifies Bearer token in Authorization header
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: 'Authorization header required'
    });
    return;
  }
  
  // Try JWT first
  const jwtToken = authService.extractTokenFromHeader(authHeader);
  if (jwtToken) {
    const payload = await authService.verifyJWT(jwtToken);
    
    if (payload) {
      // Get user from database
      const user = await authService.getUserById(payload.userId);
      
      if (user) {
        req.user = {
          id: user.id,
          name: user.name,
          type: user.type as 'human' | 'ai',
          permissions: payload.permissions,
        };
        req.authType = 'jwt';
        next();
        return;
      }
    }
  }
  
  // Try API key
  const apiKey = authService.extractAPIKeyFromHeader(authHeader) || req.headers['x-api-key'] as string;
  
  if (apiKey) {
    const result = await authService.verifyAPIKey(apiKey);
    
    if (result) {
      req.user = {
        id: result.user.id,
        name: result.user.name,
        type: result.user.type as 'human' | 'ai',
        permissions: result.permissions,
      };
      req.authType = 'api_key';
      next();
      return;
    }
  }
  
  // Neither worked
  res.status(401).json({
    success: false,
    error: 'Invalid or expired token'
  });
}

/**
 * Optional Authentication Middleware
 * 
 * Sets req.user if token provided, but doesn't require it
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    next();
    return;
  }
  
  // Try JWT
  const jwtToken = authService.extractTokenFromHeader(authHeader);
  if (jwtToken) {
    const payload = await authService.verifyJWT(jwtToken);
    
    if (payload) {
      const user = await authService.getUserById(payload.userId);
      
      if (user) {
        req.user = {
          id: user.id,
          name: user.name,
          type: user.type as 'human' | 'ai',
          permissions: payload.permissions,
        };
        req.authType = 'jwt';
      }
    }
    next();
    return;
  }
  
  // Try API key
  const apiKey = authService.extractAPIKeyFromHeader(authHeader) || req.headers['x-api-key'] as string;
  
  if (apiKey) {
    const result = await authService.verifyAPIKey(apiKey);
    
    if (result) {
      req.user = {
        id: result.user.id,
        name: result.user.name,
        type: result.user.type as 'human' | 'ai',
        permissions: result.permissions,
      };
      req.authType = 'api_key';
    }
  }
  
  next();
}

/**
 * Require Specific Permission
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }
    
    if (!req.user.permissions.includes(permission)) {
      res.status(403).json({
        success: false,
        error: `Permission '${permission}' required`
      });
      return;
    }
    
    next();
  };
}

/**
 * Require AI Agent
 */
export function requireAI(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }
  
  if (req.user.type !== 'ai') {
    res.status(403).json({
      success: false,
      error: 'AI agent access required'
    });
    return;
  }
  
  next();
}

/**
 * Require Human User
 */
export function requireHuman(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }
  
  if (req.user.type !== 'human') {
    res.status(403).json({
      success: false,
      error: 'Human user access required'
    });
    return;
  }
  
  next();
}

/**
 * Rate Limiting Middleware (Basic)
 */
export function rateLimit(maxRequests: number = 60) {
  const requests = new Map<string, number[]>();
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.user?.id || req.ip || 'anonymous';
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute
    
    // Get existing requests
    let userRequests = requests.get(identifier) || [];
    
    // Filter to current window
    userRequests = userRequests.filter(time => time > windowStart);
    
    // Check limit
    if (userRequests.length >= maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Try again later.',
        retryAfter: 60
      });
      return;
    }
    
    // Add current request
    userRequests.push(now);
    requests.set(identifier, userRequests);
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - userRequests.length).toString());
    
    next();
  };
}
