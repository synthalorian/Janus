import { Router, Request, Response } from 'express';
import { authService } from '../auth/service.js';
import { requireAuth } from '../auth/middleware.js';
import { createApiKeySchema, logoutSchema, parseOrThrow, refreshSchema, registerSchema } from '../contracts/auth.js';

export const authRouter = Router();

// ==================== Registration ====================

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, type, metadata } = parseOrThrow(registerSchema, req.body);

    const { user, apiKey } = await authService.registerUser(name, type, metadata);
    
    // Generate JWT
    const token = await authService.generateJWT(user);
    
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          type: user.type,
        },
        token,
        apiKey, // Show once
        message: 'Save your API key - it will not be shown again'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    const status = message.startsWith('Invalid ') ? 400 : 500;
    res.status(status).json({
      success: false,
      error: message
    });
  }
});

// ==================== Token Refresh ====================

authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = parseOrThrow(refreshSchema, req.body);
    const user = await authService.verifyRefreshToken(refreshToken);
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token'
      });
      return;
    }
    
    // Generate new JWT
    const token = await authService.generateJWT(user);
    
    // Rotate refresh token
    const newRefreshToken = await authService.createRefreshToken(user.id);
    
    res.json({
      success: true,
      data: {
        token,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token refresh failed';
    const status = message.startsWith('Invalid ') ? 400 : 500;
    res.status(status).json({
      success: false,
      error: message
    });
  }
});

// ==================== API Key Management ====================

authRouter.post('/keys', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, permissions, expiresInDays } = parseOrThrow(createApiKeySchema, req.body);
    const result = await authService.createAPIKey(
      req.user!.id,
      name,
      permissions,
      expiresInDays
    );
    
    if (result.success) {
      res.status(201).json({
        success: true,
        data: {
          key: result.key,
          keyId: result.keyId,
          name: result.name,
          message: 'Save this API key - it will not be shown again'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create API key';
    const status = message.startsWith('Invalid ') ? 400 : 500;
    res.status(status).json({
      success: false,
      error: message
    });
  }
});

authRouter.get('/keys', requireAuth, async (req: Request, res: Response) => {
  try {
    const keys = await authService.listAPIKeys(req.user!.id);
    
    // Don't return full key hashes
    const safeKeys = keys.map(k => ({
      id: k.id,
      name: k.name,
      prefix: k.keyPrefix,
      permissions: k.permissions,
      isActive: k.isActive,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
    }));
    
    res.json({
      success: true,
      data: safeKeys
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to list API keys'
    });
  }
});

authRouter.delete('/keys/:keyId', requireAuth, async (req: Request, res: Response) => {
  try {
    const keyId = Array.isArray(req.params.keyId) ? req.params.keyId[0] : req.params.keyId;
    const success = await authService.revokeAPIKey(keyId, req.user!.id);
    
    if (success) {
      res.json({
        success: true,
        data: { message: 'API key revoked' }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to revoke API key'
    });
  }
});

// ==================== Current User ====================

authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      user: req.user,
      authType: req.authType
    }
  });
});

// ==================== Logout ====================

authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = parseOrThrow(logoutSchema, req.body ?? {});

    if (refreshToken) {
      try {
        await authService.revokeRefreshToken(refreshToken);
      } catch (error) {
        // Ignore errors on logout
      }
    }

    res.json({
      success: true,
      data: { message: 'Logged out successfully' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logout failed';
    const status = message.startsWith('Invalid ') ? 400 : 500;
    res.status(status).json({ success: false, error: message });
  }
});
