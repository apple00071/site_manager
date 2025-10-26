/**
 * Global error handling utility for the Apple Interior Manager application
 */

type ErrorLogLevel = 'info' | 'warning' | 'error' | 'critical';

interface ErrorLogOptions {
  level: ErrorLogLevel;
  context?: Record<string, any>;
  userId?: string;
}

/**
 * Logs errors to the console and optionally to a monitoring service
 */
export const logError = (error: Error, options: ErrorLogOptions) => {
  const { level, context, userId } = options;
  
  // Format the error for logging
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: error.message,
    stack: error.stack,
    context,
    userId,
  };
  
  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${level.toUpperCase()}] ${error.message}`, logEntry);
  }
  
  // In production, you would send this to a logging service
  // Example: sendToLoggingService(logEntry);
};

/**
 * Handles API errors and returns appropriate responses
 */
export const handleApiError = (error: any) => {
  // Log the error
  logError(error instanceof Error ? error : new Error(String(error)), {
    level: 'error',
    context: { source: 'API' },
  });
  
  // Return appropriate error response
  return {
    error: {
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message || 'Unknown error',
      code: error.code || 'INTERNAL_ERROR',
    },
    status: error.status || 500,
  };
};

/**
 * Handles authentication errors
 */
export const handleAuthError = (error: any, userId?: string) => {
  logError(error instanceof Error ? error : new Error(String(error)), {
    level: 'warning',
    context: { source: 'Authentication' },
    userId,
  });
  
  return {
    message: 'Authentication failed. Please try again.',
    code: 'AUTH_ERROR',
  };
};

/**
 * Sanitizes error messages for client display
 */
export const sanitizeErrorMessage = (message: string): string => {
  // Remove sensitive information from error messages
  const sensitivePatterns = [
    /password/i,
    /token/i,
    /key/i,
    /secret/i,
    /credential/i,
  ];
  
  let sanitized = message;
  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(
      new RegExp(`(${pattern.source}[^\\s:]*)[^\\s]*`, 'gi'),
      '$1: [REDACTED]'
    );
  });
  
  return sanitized;
};