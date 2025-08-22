/**
 * Security Configuration and Test Environment Setup
 * 
 * Provides security configuration, environment setup utilities, and mock implementations
 * for comprehensive security and compliance testing automation.
 * 
 * @version 2.0.0
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// ===== SECURITY CONFIGURATION =====

export const SECURITY_CONFIG = {
  jwt: {
    secretKey: process.env.JWT_SECRET_KEY || 'test-security-key-2024',
    algorithm: 'HS256' as jwt.Algorithm,
    issuer: 'https://prepbettr-security-test.com',
    audience: 'prepbettr-test-app',
    expiresIn: '1h',
    notBefore: '0',
    clockTolerance: 30
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    iterations: 10000
  },
  security: {
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    passwordMinLength: 8,
    passwordRequireSpecial: true,
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    csrfTokenLength: 32
  },
  rbac: {
    roles: ['guest', 'user', 'interviewer', 'admin', 'super_admin'],
    permissions: [
      'read', 'write', 'delete', 'profile_update', 'take_interviews',
      'conduct_interviews', 'view_reports', 'manage_users', 'view_analytics',
      'gdpr_operations', 'system_admin'
    ]
  },
  gdpr: {
    dataRetentionDays: 365,
    deletionGracePeriod: 30,
    exportRequestTimeout: 72 * 60 * 60 * 1000, // 72 hours
    auditLogRetentionYears: 7
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    maxAuthRequests: 10,
    blockDuration: 60 * 60 * 1000 // 1 hour
  }
};

// ===== SECURITY UTILITIES =====

export class SecurityUtils {
  /**
   * Generate secure random token
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash password with salt
   */
  static async hashPassword(password: string): Promise<{ hash: string; salt: string }> {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, SECURITY_CONFIG.encryption.iterations, 64, 'sha512').toString('hex');
    
    return { hash, salt };
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
    const hashVerify = crypto.pbkdf2Sync(password, salt, SECURITY_CONFIG.encryption.iterations, 64, 'sha512').toString('hex');
    return hash === hashVerify;
  }

  /**
   * Encrypt sensitive data
   */
  static encryptData(plaintext: string, key?: string): {
    encrypted: string;
    iv: string;
    tag: string;
    key: string;
  } {
    const encryptionKey = key ? Buffer.from(key, 'hex') : crypto.randomBytes(SECURITY_CONFIG.encryption.keyLength);
    const iv = crypto.randomBytes(SECURITY_CONFIG.encryption.ivLength);
    const cipher = crypto.createCipher(SECURITY_CONFIG.encryption.algorithm, encryptionKey);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: (cipher as any).getAuthTag?.()?.toString('hex') || '',
      key: encryptionKey.toString('hex')
    };
  }

  /**
   * Decrypt sensitive data
   */
  static decryptData(encryptedData: {
    encrypted: string;
    iv: string;
    tag: string;
    key: string;
  }): string {
    const key = Buffer.from(encryptedData.key, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const decipher = crypto.createDecipher(SECURITY_CONFIG.encryption.algorithm, key);
    
    if (encryptedData.tag) {
      (decipher as any).setAuthTag?.(Buffer.from(encryptedData.tag, 'hex'));
    }
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Generate CSRF token
   */
  static generateCSRFToken(): string {
    return crypto.randomBytes(SECURITY_CONFIG.security.csrfTokenLength).toString('base64');
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (password.length < SECURITY_CONFIG.security.passwordMinLength) {
      errors.push(`Password must be at least ${SECURITY_CONFIG.security.passwordMinLength} characters long`);
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (SECURITY_CONFIG.security.passwordRequireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize HTML input
   */
  static sanitizeHTML(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<[^>]+>/g, '');
  }

  /**
   * Validate SQL injection patterns
   */
  static containsSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b)/i,
      /('|\"|;|--|\||\/\*|\*\/)/,
      /(\bOR\b|\bAND\b)\s+('|\")?\w*('|\")?(\s+)?=(\s+)?('|\")?(\w*)?('|\")?/i,
      /\b(EXEC|EXECUTE|SP_|XP_)\b/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  }
}

// ===== MOCK AUTHENTICATION SERVICE =====

export class MockAuthService {
  private static instance: MockAuthService;
  private tokens: Map<string, any> = new Map();
  private blacklistedTokens: Set<string> = new Set();
  private loginAttempts: Map<string, { count: number; lastAttempt: Date }> = new Map();

  static getInstance(): MockAuthService {
    if (!this.instance) {
      this.instance = new MockAuthService();
    }
    return this.instance;
  }

  /**
   * Generate JWT token
   */
  generateToken(payload: any, options: any = {}): string {
    const tokenPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (options.expiresIn || 3600),
      iss: SECURITY_CONFIG.jwt.issuer,
      aud: SECURITY_CONFIG.jwt.audience
    };

    const token = jwt.sign(tokenPayload, SECURITY_CONFIG.jwt.secretKey, {
      algorithm: SECURITY_CONFIG.jwt.algorithm,
      ...options
    });

    this.tokens.set(token, {
      payload: tokenPayload,
      createdAt: new Date(),
      isActive: true
    });

    return token;
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): { isValid: boolean; payload?: any; error?: string } {
    try {
      if (this.blacklistedTokens.has(token)) {
        return { isValid: false, error: 'TOKEN_BLACKLISTED' };
      }

      const decoded = jwt.verify(token, SECURITY_CONFIG.jwt.secretKey, {
        algorithms: [SECURITY_CONFIG.jwt.algorithm],
        issuer: SECURITY_CONFIG.jwt.issuer,
        audience: SECURITY_CONFIG.jwt.audience,
        clockTolerance: SECURITY_CONFIG.jwt.clockTolerance
      });

      return { isValid: true, payload: decoded };
    } catch (error: any) {
      let errorCode = 'INVALID_TOKEN';
      
      if (error.name === 'TokenExpiredError') {
        errorCode = 'TOKEN_EXPIRED';
      } else if (error.name === 'JsonWebTokenError') {
        errorCode = 'INVALID_FORMAT';
      }

      return { isValid: false, error: errorCode };
    }
  }

  /**
   * Blacklist token (logout)
   */
  blacklistToken(token: string): void {
    this.blacklistedTokens.add(token);
    if (this.tokens.has(token)) {
      this.tokens.get(token)!.isActive = false;
    }
  }

  /**
   * Check login attempts
   */
  checkLoginAttempts(identifier: string): { isLocked: boolean; attemptsLeft?: number } {
    const attempts = this.loginAttempts.get(identifier);
    
    if (!attempts) {
      return { isLocked: false, attemptsLeft: SECURITY_CONFIG.security.maxLoginAttempts };
    }

    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt.getTime();
    
    if (attempts.count >= SECURITY_CONFIG.security.maxLoginAttempts) {
      if (timeSinceLastAttempt < SECURITY_CONFIG.security.lockoutDuration) {
        return { isLocked: true };
      } else {
        // Reset attempts after lockout period
        this.loginAttempts.delete(identifier);
        return { isLocked: false, attemptsLeft: SECURITY_CONFIG.security.maxLoginAttempts };
      }
    }

    return { 
      isLocked: false, 
      attemptsLeft: SECURITY_CONFIG.security.maxLoginAttempts - attempts.count 
    };
  }

  /**
   * Record login attempt
   */
  recordLoginAttempt(identifier: string, success: boolean): void {
    if (success) {
      this.loginAttempts.delete(identifier);
      return;
    }

    const attempts = this.loginAttempts.get(identifier) || { count: 0, lastAttempt: new Date() };
    attempts.count += 1;
    attempts.lastAttempt = new Date();
    this.loginAttempts.set(identifier, attempts);
  }

  /**
   * Get all active tokens (for testing)
   */
  getActiveTokens(): string[] {
    return Array.from(this.tokens.entries())
      .filter(([_, data]) => data.isActive && !this.blacklistedTokens.has(_))
      .map(([token, _]) => token);
  }

  /**
   * Clear all tokens (for testing)
   */
  clearAllTokens(): void {
    this.tokens.clear();
    this.blacklistedTokens.clear();
    this.loginAttempts.clear();
  }
}

// ===== RBAC PERMISSION MANAGER =====

export class RBACManager {
  private static rolePermissions: Record<string, string[]> = {
    guest: ['read'],
    user: ['read', 'profile_update', 'take_interviews'],
    interviewer: ['read', 'write', 'conduct_interviews', 'view_reports'],
    admin: ['read', 'write', 'delete', 'manage_users', 'view_analytics', 'gdpr_operations'],
    super_admin: ['read', 'write', 'delete', 'manage_users', 'view_analytics', 'gdpr_operations', 'system_admin']
  };

  /**
   * Get permissions for roles
   */
  static getPermissions(roles: string[]): string[] {
    const permissions = new Set<string>();
    
    roles.forEach(role => {
      const rolePerms = this.rolePermissions[role] || [];
      rolePerms.forEach(perm => permissions.add(perm));
    });

    return Array.from(permissions);
  }

  /**
   * Check if user has required permission
   */
  static hasPermission(userRoles: string[], requiredPermission: string): boolean {
    const userPermissions = this.getPermissions(userRoles);
    return userPermissions.includes(requiredPermission);
  }

  /**
   * Check if user has required role
   */
  static hasRole(userRoles: string[], requiredRole: string): boolean {
    return userRoles.includes(requiredRole);
  }

  /**
   * Get role hierarchy level (lower number = higher privilege)
   */
  static getRoleLevel(role: string): number {
    const hierarchy = {
      super_admin: 0,
      admin: 1,
      interviewer: 2,
      user: 3,
      guest: 4
    };
    
    return hierarchy[role as keyof typeof hierarchy] ?? 999;
  }

  /**
   * Check if user can perform action on target
   */
  static canPerformAction(userRoles: string[], targetRoles: string[], action: string): boolean {
    const userLevel = Math.min(...userRoles.map(role => this.getRoleLevel(role)));
    const targetLevel = Math.min(...targetRoles.map(role => this.getRoleLevel(role)));
    
    // Can only perform actions on users with lower privilege levels
    return userLevel < targetLevel && this.hasPermission(userRoles, action);
  }
}

// ===== GDPR COMPLIANCE MANAGER =====

export class GDPRComplianceManager {
  private static auditTrail: Array<{
    id: string;
    userId: string;
    action: string;
    data?: any;
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
  }> = [];

  /**
   * Log audit trail entry
   */
  static logAuditEntry(entry: {
    userId: string;
    action: string;
    data?: any;
    ipAddress?: string;
    userAgent?: string;
  }): string {
    const auditEntry = {
      id: crypto.randomUUID(),
      ...entry,
      timestamp: new Date()
    };

    this.auditTrail.push(auditEntry);
    return auditEntry.id;
  }

  /**
   * Get audit trail for user
   */
  static getAuditTrail(userId?: string): Array<any> {
    if (userId) {
      return this.auditTrail.filter(entry => entry.userId === userId);
    }
    return [...this.auditTrail];
  }

  /**
   * Generate data export for user
   */
  static generateDataExport(userId: string): {
    exportId: string;
    userId: string;
    data: any;
    createdAt: Date;
  } {
    const exportId = crypto.randomUUID();
    
    // Mock user data export
    const exportData = {
      exportId,
      userId,
      data: {
        users: {
          id: userId,
          personalData: 'Mock personal data for export',
          preferences: 'Mock preferences',
          activity: 'Mock activity logs'
        },
        interviews: {
          sessions: 'Mock interview sessions',
          recordings: 'Mock recordings metadata'
        }
      },
      createdAt: new Date()
    };

    this.logAuditEntry({
      userId,
      action: 'data_export_generated',
      data: { exportId }
    });

    return exportData;
  }

  /**
   * Process data deletion request
   */
  static processDeletionRequest(userId: string, reason: string): {
    requestId: string;
    status: string;
    scheduledFor?: Date;
  } {
    const requestId = crypto.randomUUID();
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + SECURITY_CONFIG.gdpr.deletionGracePeriod);

    this.logAuditEntry({
      userId,
      action: 'data_deletion_requested',
      data: { requestId, reason, scheduledFor }
    });

    return {
      requestId,
      status: 'processing',
      scheduledFor
    };
  }

  /**
   * Check data retention policy
   */
  static checkRetentionPolicy(): {
    retentionPolicyDays: number;
    expiredDataCount: number;
    scheduledForDeletion: boolean;
  } {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - SECURITY_CONFIG.gdpr.dataRetentionDays);

    const expiredEntries = this.auditTrail.filter(entry => entry.timestamp < retentionDate);

    return {
      retentionPolicyDays: SECURITY_CONFIG.gdpr.dataRetentionDays,
      expiredDataCount: expiredEntries.length,
      scheduledForDeletion: expiredEntries.length > 0
    };
  }

  /**
   * Clear audit trail (for testing)
   */
  static clearAuditTrail(): void {
    this.auditTrail = [];
  }
}

// ===== SECURITY HEADERS =====

export const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.prepbettr.com",
    "frame-src 'none'",
    "object-src 'none'",
    "media-src 'self'",
    "worker-src 'self'"
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': [
    'camera=(),',
    'microphone=(),',
    'geolocation=(),',
    'interest-cohort=()'
  ].join(' ')
};

// ===== EXPORT DEFAULT CONFIGURATION =====

export default {
  SECURITY_CONFIG,
  SecurityUtils,
  MockAuthService,
  RBACManager,
  GDPRComplianceManager,
  SECURITY_HEADERS
};
