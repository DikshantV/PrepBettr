/**
 * Edge-Compatible Voice Session Storage
 * 
 * Provides session storage for WebSocket proxy routes that need to run in Edge runtime.
 * This avoids Azure Key Vault dependencies by storing only minimal session data.
 */

/**
 * Minimal session data needed for WebSocket proxy
 */
export interface VoiceSessionProxy {
  sessionId: string;
  wsUrl: string;
  createdAt: Date;
}

/**
 * In-memory session storage for Edge runtime compatibility
 * In production, this could be backed by Redis or similar edge-compatible storage
 */
class VoiceSessionStorage {
  private sessions = new Map<string, VoiceSessionProxy>();

  /**
   * Store a session for WebSocket proxy access
   */
  storeSession(session: VoiceSessionProxy): void {
    this.sessions.set(session.sessionId, session);
    
    // Auto-cleanup old sessions after 1 hour
    setTimeout(() => {
      this.sessions.delete(session.sessionId);
    }, 60 * 60 * 1000);
  }

  /**
   * Get session by ID for WebSocket proxy
   */
  getSession(sessionId: string): VoiceSessionProxy | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Remove session from storage
   */
  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Get all active sessions (for debugging)
   */
  getActiveSessions(): VoiceSessionProxy[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clear all sessions
   */
  clear(): void {
    this.sessions.clear();
  }
}

// Singleton instance for edge runtime
let voiceSessionStorageInstance: VoiceSessionStorage | null = null;

/**
 * Get shared voice session storage instance
 */
export function getVoiceSessionStorage(): VoiceSessionStorage {
  if (!voiceSessionStorageInstance) {
    voiceSessionStorageInstance = new VoiceSessionStorage();
  }
  return voiceSessionStorageInstance;
}
