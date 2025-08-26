/**
 * Centralized logging utility with debug flag support
 * Helps reduce verbose console.debug statements throughout the codebase
 */

// Environment-based debug flag
const DEBUG = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';

export interface LogContext {
  [key: string]: any;
}

/**
 * Core logger with emoji prefixes for visual recognition
 */
export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (DEBUG) {
      context 
        ? console.debug(`🔍 ${message}`, context)
        : console.debug(`🔍 ${message}`);
    }
  },

  info: (message: string, context?: LogContext) => {
    context 
      ? console.info(`ℹ️ ${message}`, context)
      : console.info(`ℹ️ ${message}`);
  },

  success: (message: string, context?: LogContext) => {
    context 
      ? console.log(`✅ ${message}`, context)
      : console.log(`✅ ${message}`);
  },

  warn: (message: string, context?: LogContext) => {
    context 
      ? console.warn(`⚠️ ${message}`, context)
      : console.warn(`⚠️ ${message}`);
  },

  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    const errorInfo = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;
      
    context 
      ? console.error(`❌ ${message}`, { error: errorInfo, ...context })
      : console.error(`❌ ${message}`, errorInfo);
  },

  // Audio-specific logging shortcuts
  audio: {
    process: (message: string, context?: LogContext) => {
      if (DEBUG) {
        context 
          ? console.debug(`🎵 ${message}`, context)
          : console.debug(`🎵 ${message}`);
      }
    },
    
    record: (message: string, context?: LogContext) => {
      if (DEBUG) {
        context 
          ? console.debug(`🎤 ${message}`, context)
          : console.debug(`🎤 ${message}`);
      }
    },

    speak: (message: string, context?: LogContext) => {
      if (DEBUG) {
        context 
          ? console.debug(`🔊 ${message}`, context)
          : console.debug(`🔊 ${message}`);
      }
    }
  },

  // State management logging
  state: (action: string, from: string, to: string, context?: LogContext) => {
    if (DEBUG) {
      const message = `State transition: ${from} → ${to}`;
      context 
        ? console.debug(`🔄 [${action}] ${message}`, context)
        : console.debug(`🔄 [${action}] ${message}`);
    }
  },

  // API request logging
  api: {
    request: (endpoint: string, method: string, context?: LogContext) => {
      if (DEBUG) {
        context 
          ? console.debug(`📤 API ${method} ${endpoint}`, context)
          : console.debug(`📤 API ${method} ${endpoint}`);
      }
    },
    
    response: (endpoint: string, status: number, context?: LogContext) => {
      const icon = status >= 200 && status < 300 ? '📥' : '❌';
      if (DEBUG) {
        context 
          ? console.debug(`${icon} API Response ${status} ${endpoint}`, context)
          : console.debug(`${icon} API Response ${status} ${endpoint}`);
      }
    }
  }
};

// Convenience exports
export const { debug, info, success, warn, error } = logger;
