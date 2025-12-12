/**
 * Extract a readable error message from various error types
 */
export function getErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  if (error?.toString) {
    return error.toString();
  }
  
  return 'Unknown error';
}

/**
 * Check if an error is retryable (transient errors like rate limits or service unavailable)
 */
export function isRetryableError(error: any): boolean {
  const errorMessage = getErrorMessage(error);
  
  // Check for specific retryable HTTP status codes
  if (errorMessage.includes('503') || errorMessage.includes('Service Unavailable')) {
    return true; // Service temporarily unavailable
  }
  
  if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
    return true; // Rate limit exceeded
  }
  
  if (errorMessage.includes('overloaded')) {
    return true; // Model overloaded
  }
  
  // Network errors that might be transient
  if (errorMessage.includes('ECONNRESET') || 
      errorMessage.includes('ETIMEDOUT') || 
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('fetch failed')) {
    return true;
  }
  
  return false;
}
