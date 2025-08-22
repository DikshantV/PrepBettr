/**
 * Security and Compliance Testing Suite
 * 
 * Automated testing for JWT validation, encryption verification, RBAC testing,
 * Key Vault integration, and GDPR compliance scenarios with audit trail validation.
 * 
 * @version 2.0.0
 */

import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { faker } from '@faker-js/faker';

// ===== TEST CONFIGURATIONS =====

const TEST_CONFIG = {
  azure: {
    keyVaultUrl: process.env.AZURE_KEY_VAULT_URI || 'https://test-keyvault.vault.azure.net',
    tenantId: process.env.AZURE_TENANT_ID || 'test-tenant-id',
    subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || 'test-subscription-id'
  },
  jwt: {
    algorithm: 'RS256',
    issuer: 'https://securetoken.google.com/prepbettr-test',
    audience: 'prepbettr-test'
  },
  encryption: {
    algorithms: ['AES-256-GCM', 'RSA-OAEP'],
    keyLengths: [256, 2048]
  },
  gdpr: {
    dataRetentionDays: 30,
    deletionRequestTimeout: 72 // hours
  }
};

// ===== SECURITY TEST UTILITIES =====

class SecurityTestUtils {
  /**
   * Generate test JWT token with various scenarios
   */
  static generateTestJWT(payload: any, options: any = {}) {
    const secret = 'test-secret-key';
    const defaults = {
      algorithm: 'HS256',
      expiresIn: '1h',
      issuer: TEST_CONFIG.jwt.issuer,
      audience: TEST_CONFIG.jwt.audience
    };
    
    return jwt.sign(payload, secret, { ...defaults, ...options });
  }

  /**
   * Generate expired JWT token
   */
  static generateExpiredJWT(payload: any) {
    return this.generateTestJWT(payload, { expiresIn: '-1h' });
  }

  /**
   * Generate malformed JWT token
   */
  static generateMalformedJWT() {
    return 'invalid.jwt.token.format';
  }

  /**
   * Encrypt test data
   */
  static encryptData(data: string, algorithm = 'aes-256-gcm'): {
    encrypted: string;
    iv: string;
    tag?: string;
    key: string;
  } {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: (cipher as any).getAuthTag?.()?.toString('hex'),
      key: key.toString('hex')
    };
  }

  /**
   * Generate test user with specific roles
   */
  static generateTestUser(roles: string[] = ['user']) {
    return {
      uid: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      roles,
      permissions: this.getRolePermissions(roles),
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
  }

  /**
   * Get permissions for roles
   */
  static getRolePermissions(roles: string[]): string[] {
    const rolePermissions = {
      admin: ['read', 'write', 'delete', 'manage_users', 'view_analytics', 'gdpr_operations'],
      interviewer: ['read', 'write', 'conduct_interviews', 'view_reports'],
      user: ['read', 'profile_update', 'take_interviews'],
      guest: ['read']
    };
    
    return roles.reduce((perms: string[], role: string) => {
      return [...perms, ...(rolePermissions[role as keyof typeof rolePermissions] || [])];
    }, []);
  }

  /**
   * Generate GDPR test data
   */
  static generateGDPRTestData() {
    return {
      userId: faker.string.uuid(),
      personalData: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        phone: faker.phone.number(),
        address: faker.location.streetAddress(),
        birthDate: faker.date.birthdate(),
        socialSecurity: faker.string.numeric(9)
      },
      sensitiveData: {
        interviewRecordings: [
          { id: faker.string.uuid(), duration: 1800, fileSize: 5242880 },
          { id: faker.string.uuid(), duration: 2100, fileSize: 6291456 }
        ],
        resumeContent: faker.lorem.paragraphs(5),
        performanceMetrics: {
          averageScore: faker.number.float({ min: 60, max: 95 }),
          interviewCount: faker.number.int({ min: 1, max: 20 }),
          improvementAreas: faker.lorem.words(10)
        }
      }
    };
  }
}

// ===== JWT SECURITY TESTS =====

test.describe('JWT Security Validation', () => {
  
  test('should validate JWT token structure and claims', async ({ page }) => {
    const testUser = SecurityTestUtils.generateTestUser(['user']);
    const validJWT = SecurityTestUtils.generateTestJWT(testUser);

    // Test JWT validation endpoint
    const response = await page.request.post('/api/auth?action=verify', {
      headers: {
        'Authorization': `Bearer ${validJWT}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status()).toBe(200);
    
    const responseData = await response.json();
    expect(responseData.success).toBe(true);
    expect(responseData.claims.uid).toBe(testUser.uid);
    expect(responseData.claims.email).toBe(testUser.email);
  });

  test('should reject expired JWT tokens', async ({ page }) => {
    const testUser = SecurityTestUtils.generateTestUser(['user']);
    const expiredJWT = SecurityTestUtils.generateExpiredJWT(testUser);

    const response = await page.request.post('/api/auth?action=verify', {
      headers: {
        'Authorization': `Bearer ${expiredJWT}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status()).toBe(401);
    
    const responseData = await response.json();
    expect(responseData.success).toBe(false);
    expect(responseData.code).toBe('TOKEN_EXPIRED');
  });

  test('should reject malformed JWT tokens', async ({ page }) => {
    const malformedJWT = SecurityTestUtils.generateMalformedJWT();

    const response = await page.request.post('/api/auth?action=verify', {
      headers: {
        'Authorization': `Bearer ${malformedJWT}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status()).toBe(401);
    
    const responseData = await response.json();
    expect(responseData.success).toBe(false);
    expect(responseData.code).toBe('INVALID_FORMAT');
  });

  test('should validate JWT issuer and audience', async ({ page }) => {
    const testUser = SecurityTestUtils.generateTestUser(['user']);
    const invalidIssuerJWT = SecurityTestUtils.generateTestJWT(testUser, {
      issuer: 'https://malicious-site.com'
    });

    const response = await page.request.post('/api/auth?action=verify', {
      headers: {
        'Authorization': `Bearer ${invalidIssuerJWT}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status()).toBe(401);
    
    const responseData = await response.json();
    expect(responseData.success).toBe(false);
    expect(responseData.code).toBe('INVALID_TOKEN');
  });

  test('should prevent JWT token reuse after logout', async ({ page }) => {
    const testUser = SecurityTestUtils.generateTestUser(['user']);
    const validJWT = SecurityTestUtils.generateTestJWT(testUser);

    // First verification should succeed
    let response = await page.request.post('/api/auth?action=verify', {
      headers: {
        'Authorization': `Bearer ${validJWT}`,
        'Content-Type': 'application/json'
      }
    });
    expect(response.status()).toBe(200);

    // Simulate logout
    await page.request.post('/api/auth/logout', {
      headers: {
        'Authorization': `Bearer ${validJWT}`,
        'Content-Type': 'application/json'
      }
    });

    // Token should now be invalidated
    response = await page.request.post('/api/auth?action=verify', {
      headers: {
        'Authorization': `Bearer ${validJWT}`,
        'Content-Type': 'application/json'
      }
    });
    expect(response.status()).toBe(401);
  });
});

// ===== RBAC SECURITY TESTS =====

test.describe('Role-Based Access Control (RBAC)', () => {

  test('should enforce admin-only endpoints', async ({ page }) => {
    const regularUser = SecurityTestUtils.generateTestUser(['user']);
    const adminUser = SecurityTestUtils.generateTestUser(['admin']);
    
    const userJWT = SecurityTestUtils.generateTestJWT(regularUser);
    const adminJWT = SecurityTestUtils.generateTestJWT(adminUser);

    // Regular user should be denied
    let response = await page.request.get('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${userJWT}` }
    });
    expect(response.status()).toBe(403);

    // Admin user should be allowed
    response = await page.request.get('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${adminJWT}` }
    });
    expect(response.status()).toBe(200);
  });

  test('should validate permission-based access', async ({ page }) => {
    const testCases = [
      {
        user: SecurityTestUtils.generateTestUser(['interviewer']),
        endpoint: '/api/interviews/manage',
        expectedStatus: 200
      },
      {
        user: SecurityTestUtils.generateTestUser(['user']),
        endpoint: '/api/interviews/manage',
        expectedStatus: 403
      },
      {
        user: SecurityTestUtils.generateTestUser(['guest']),
        endpoint: '/api/profile/update',
        expectedStatus: 403
      }
    ];

    for (const testCase of testCases) {
      const jwt = SecurityTestUtils.generateTestJWT(testCase.user);
      
      const response = await page.request.post(testCase.endpoint, {
        headers: { 'Authorization': `Bearer ${jwt}` },
        data: { test: 'data' }
      });
      
      expect(response.status()).toBe(testCase.expectedStatus);
    }
  });

  test('should prevent privilege escalation', async ({ page }) => {
    const regularUser = SecurityTestUtils.generateTestUser(['user']);
    const userJWT = SecurityTestUtils.generateTestJWT(regularUser);

    // Attempt to modify user roles
    const response = await page.request.post('/api/auth?action=claims', {
      headers: {
        'Authorization': `Bearer ${userJWT}`,
        'Content-Type': 'application/json'
      },
      data: {
        uid: regularUser.uid,
        claims: { roles: ['admin'] }
      }
    });

    expect(response.status()).toBe(403);
    
    const responseData = await response.json();
    expect(responseData.success).toBe(false);
    expect(responseData.error).toContain('admin role required');
  });
});

// ===== ENCRYPTION TESTS =====

test.describe('Data Encryption Verification', () => {

  test('should verify data encryption at rest', async ({ page }) => {
    const testUser = SecurityTestUtils.generateTestUser(['user']);
    const userJWT = SecurityTestUtils.generateTestJWT(testUser);
    
    const sensitiveData = {
      personalInfo: 'John Doe, SSN: 123-45-6789',
      creditCard: '4111-1111-1111-1111',
      notes: 'Confidential interview feedback'
    };

    // Store sensitive data
    const storeResponse = await page.request.post('/api/profile/sensitive-data', {
      headers: {
        'Authorization': `Bearer ${userJWT}`,
        'Content-Type': 'application/json'
      },
      data: sensitiveData
    });

    expect(storeResponse.status()).toBe(200);

    // Verify data is encrypted in storage by checking raw storage
    const rawDataResponse = await page.request.get('/api/debug/raw-data', {
      headers: { 'Authorization': `Bearer ${userJWT}` }
    });
    
    const rawData = await rawDataResponse.text();
    
    // Sensitive data should not appear in plain text
    expect(rawData).not.toContain('123-45-6789');
    expect(rawData).not.toContain('4111-1111-1111-1111');
    expect(rawData).not.toContain('Confidential interview feedback');
    
    // Should contain encrypted markers
    expect(rawData).toMatch(/encrypted|cipher|aes/i);
  });

  test('should verify HTTPS enforcement', async ({ page }) => {
    // Test HTTP to HTTPS redirect
    const httpResponse = await page.request.get('http://localhost:3000/api/health');
    
    if (httpResponse.status() === 301 || httpResponse.status() === 302) {
      const location = httpResponse.headers()['location'];
      expect(location).toMatch(/^https:/);
    }

    // Test secure headers
    const httpsResponse = await page.request.get('/api/health');
    const headers = httpsResponse.headers();
    
    expect(headers['strict-transport-security']).toBeTruthy();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-xss-protection']).toBe('1; mode=block');
  });

  test('should validate Key Vault integration', async ({ page }) => {
    // Test Key Vault secret retrieval
    const response = await page.request.get('/api/config/secrets-health');
    expect(response.status()).toBe(200);
    
    const healthData = await response.json();
    expect(healthData.keyVault.status).toBe('healthy');
    expect(healthData.secretsAccessible).toBe(true);
    
    // Verify secrets are not exposed in responses
    expect(JSON.stringify(healthData)).not.toMatch(/secret|key|password/i);
  });
});

// ===== GDPR COMPLIANCE TESTS =====

test.describe('GDPR Compliance Validation', () => {

  test('should handle data subject access requests (SAR)', async ({ page }) => {
    const testUser = SecurityTestUtils.generateTestUser(['user']);
    const userJWT = SecurityTestUtils.generateTestJWT(testUser);
    const gdprData = SecurityTestUtils.generateGDPRTestData();

    // Create user data
    await page.request.post('/api/profile', {
      headers: {
        'Authorization': `Bearer ${userJWT}`,
        'Content-Type': 'application/json'
      },
      data: gdprData
    });

    // Request data export (SAR)
    const exportResponse = await page.request.post('/api/gdpr/export', {
      headers: {
        'Authorization': `Bearer ${userJWT}`,
        'Content-Type': 'application/json'
      },
      data: { userId: testUser.uid }
    });

    expect(exportResponse.status()).toBe(200);
    
    const exportData = await exportResponse.json();
    expect(exportData.success).toBe(true);
    expect(exportData.exportData).toBeTruthy();
    expect(exportData.exportData.userId).toBe(testUser.uid);
    expect(exportData.exportData.data.users).toBeTruthy();
  });

  test('should handle right to erasure (deletion) requests', async ({ page }) => {
    const testUser = SecurityTestUtils.generateTestUser(['user']);
    const userJWT = SecurityTestUtils.generateTestJWT(testUser);
    const gdprData = SecurityTestUtils.generateGDPRTestData();

    // Create user data first
    await page.request.post('/api/profile', {
      headers: {
        'Authorization': `Bearer ${userJWT}`,
        'Content-Type': 'application/json'
      },
      data: gdprData
    });

    // Request data deletion
    const deletionResponse = await page.request.delete('/api/gdpr/delete', {
      headers: {
        'Authorization': `Bearer ${userJWT}`,
        'Content-Type': 'application/json'
      },
      data: {
        userId: testUser.uid,
        reason: 'User requested account deletion'
      }
    });

    expect(deletionResponse.status()).toBe(200);
    
    const deletionData = await deletionResponse.json();
    expect(deletionData.success).toBe(true);
    expect(deletionData.requestId).toBeTruthy();
    expect(deletionData.status).toBe('processing');
    
    // Verify audit trail
    const auditResponse = await page.request.get(`/api/gdpr/audit/${deletionData.requestId}`, {
      headers: { 'Authorization': `Bearer ${userJWT}` }
    });
    
    const auditData = await auditResponse.json();
    expect(auditData.action).toBe('data_deletion_requested');
    expect(auditData.userId).toBe(testUser.uid);
    expect(auditData.timestamp).toBeTruthy();
  });

  test('should validate data retention policies', async ({ page }) => {
    const testUser = SecurityTestUtils.generateTestUser(['admin']);
    const adminJWT = SecurityTestUtils.generateTestJWT(testUser);

    // Check retention policy enforcement
    const retentionResponse = await page.request.get('/api/gdpr/retention-check', {
      headers: { 'Authorization': `Bearer ${adminJWT}` }
    });

    expect(retentionResponse.status()).toBe(200);
    
    const retentionData = await retentionResponse.json();
    expect(retentionData.retentionPolicyDays).toBe(TEST_CONFIG.gdpr.dataRetentionDays);
    expect(retentionData.expiredDataCount).toBeGreaterThanOrEqual(0);
    
    if (retentionData.expiredDataCount > 0) {
      expect(retentionData.scheduledForDeletion).toBe(true);
    }
  });

  test('should validate consent management', async ({ page }) => {
    const testUser = SecurityTestUtils.generateTestUser(['user']);
    const userJWT = SecurityTestUtils.generateTestJWT(testUser);

    // Update consent preferences
    const consentResponse = await page.request.post('/api/gdpr/consent', {
      headers: {
        'Authorization': `Bearer ${userJWT}`,
        'Content-Type': 'application/json'
      },
      data: {
        marketing: false,
        analytics: true,
        functionalCookies: true,
        dataProcessing: true
      }
    });

    expect(consentResponse.status()).toBe(200);
    
    // Verify consent is respected
    const profileResponse = await page.request.get('/api/profile/analytics', {
      headers: { 'Authorization': `Bearer ${userJWT}` }
    });
    
    expect(profileResponse.status()).toBe(200); // Analytics allowed
    
    const marketingResponse = await page.request.get('/api/profile/marketing', {
      headers: { 'Authorization': `Bearer ${userJWT}` }
    });
    
    expect(marketingResponse.status()).toBe(403); // Marketing denied
  });

  test('should validate audit trail completeness', async ({ page }) => {
    const testUser = SecurityTestUtils.generateTestUser(['admin']);
    const adminJWT = SecurityTestUtils.generateTestJWT(testUser);

    // Perform various actions that should be audited
    const actions = [
      { method: 'POST', endpoint: '/api/profile', data: { name: 'Test' } },
      { method: 'GET', endpoint: '/api/profile' },
      { method: 'PUT', endpoint: '/api/profile', data: { name: 'Updated' } },
      { method: 'DELETE', endpoint: '/api/profile/session/test-id' }
    ];

    for (const action of actions) {
      await page.request[action.method.toLowerCase() as keyof typeof page.request](action.endpoint, {
        headers: {
          'Authorization': `Bearer ${adminJWT}`,
          'Content-Type': 'application/json'
        },
        data: action.data
      });
    }

    // Check audit trail
    const auditResponse = await page.request.get('/api/gdpr/audit-trail', {
      headers: { 'Authorization': `Bearer ${adminJWT}` }
    });

    expect(auditResponse.status()).toBe(200);
    
    const auditData = await auditResponse.json();
    expect(auditData.entries.length).toBeGreaterThanOrEqual(actions.length);
    
    // Verify audit entry structure
    const auditEntry = auditData.entries[0];
    expect(auditEntry.userId).toBeTruthy();
    expect(auditEntry.action).toBeTruthy();
    expect(auditEntry.timestamp).toBeTruthy();
    expect(auditEntry.ipAddress).toBeTruthy();
    expect(auditEntry.userAgent).toBeTruthy();
  });
});

// ===== SECURITY HEADERS AND POLICIES =====

test.describe('Security Headers and Policies', () => {

  test('should enforce Content Security Policy (CSP)', async ({ page }) => {
    await page.goto('/');
    
    const cspHeader = await page.evaluate(() => {
      const metaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
      return metaTags.length > 0 ? metaTags[0].getAttribute('content') : null;
    });

    expect(cspHeader).toBeTruthy();
    expect(cspHeader).toContain("default-src 'self'");
    expect(cspHeader).toContain("script-src 'self'");
    expect(cspHeader).toContain("style-src 'self' 'unsafe-inline'");
    expect(cspHeader).toContain("object-src 'none'");
  });

  test('should prevent clickjacking attacks', async ({ page }) => {
    const response = await page.request.get('/');
    const headers = response.headers();
    
    expect(headers['x-frame-options']).toBe('DENY');
  });

  test('should prevent MIME type sniffing', async ({ page }) => {
    const response = await page.request.get('/api/health');
    const headers = response.headers();
    
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  test('should enforce XSS protection', async ({ page }) => {
    const response = await page.request.get('/');
    const headers = response.headers();
    
    expect(headers['x-xss-protection']).toBe('1; mode=block');
  });
});

// ===== INPUT VALIDATION AND SANITIZATION =====

test.describe('Input Validation and Sanitization', () => {

  test('should prevent SQL injection attempts', async ({ page }) => {
    const testUser = SecurityTestUtils.generateTestUser(['user']);
    const userJWT = SecurityTestUtils.generateTestJWT(testUser);
    
    const maliciousInputs = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "admin'--",
      "' UNION SELECT password FROM users WHERE username='admin'--"
    ];

    for (const maliciousInput of maliciousInputs) {
      const response = await page.request.get(`/api/profile/search?query=${encodeURIComponent(maliciousInput)}`, {
        headers: { 'Authorization': `Bearer ${userJWT}` }
      });
      
      // Should either reject the input or handle it safely
      if (response.status() === 400) {
        const errorData = await response.json();
        expect(errorData.error).toMatch(/invalid|validation/i);
      } else if (response.status() === 200) {
        const responseData = await response.json();
        // Should not contain evidence of SQL injection success
        expect(JSON.stringify(responseData)).not.toMatch(/password|admin|users/i);
      }
    }
  });

  test('should prevent XSS attacks', async ({ page }) => {
    const testUser = SecurityTestUtils.generateTestUser(['user']);
    const userJWT = SecurityTestUtils.generateTestJWT(testUser);
    
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      '<img src=x onerror=alert("XSS")>',
      '"><script>alert("XSS")</script>'
    ];

    for (const payload of xssPayloads) {
      const response = await page.request.post('/api/profile/notes', {
        headers: {
          'Authorization': `Bearer ${userJWT}`,
          'Content-Type': 'application/json'
        },
        data: { note: payload }
      });
      
      if (response.status() === 200) {
        // Retrieve the data and verify it's sanitized
        const getResponse = await page.request.get('/api/profile/notes', {
          headers: { 'Authorization': `Bearer ${userJWT}` }
        });
        
        const notesData = await getResponse.json();
        const savedNote = notesData.notes.find((n: any) => n.content === payload);
        
        if (savedNote) {
          // Content should be sanitized
          expect(savedNote.content).not.toContain('<script>');
          expect(savedNote.content).not.toContain('javascript:');
          expect(savedNote.content).not.toContain('onerror=');
        }
      }
    }
  });

  test('should validate file upload security', async ({ page }) => {
    const testUser = SecurityTestUtils.generateTestUser(['user']);
    const userJWT = SecurityTestUtils.generateTestJWT(testUser);
    
    // Test malicious file upload attempts
    const maliciousFiles = [
      { name: 'malware.exe', content: 'MZ\x90\x00\x03\x00\x00\x00', type: 'application/x-msdownload' },
      { name: 'script.php', content: '<?php system($_GET["cmd"]); ?>', type: 'application/x-php' },
      { name: 'payload.js', content: 'eval(atob("YWxlcnQoIlhTUyIp"))', type: 'application/javascript' }
    ];

    for (const file of maliciousFiles) {
      const formData = new FormData();
      formData.append('file', new Blob([file.content], { type: file.type }), file.name);
      
      const response = await page.request.post('/api/profile/resume-upload', {
        headers: { 'Authorization': `Bearer ${userJWT}` },
        multipart: {
          file: {
            name: file.name,
            mimeType: file.type,
            buffer: Buffer.from(file.content)
          }
        }
      });
      
      // Should reject malicious files
      expect([400, 403, 415]).toContain(response.status());
      
      const errorData = await response.json();
      expect(errorData.error).toMatch(/file type|invalid|not allowed/i);
    }
  });
});
