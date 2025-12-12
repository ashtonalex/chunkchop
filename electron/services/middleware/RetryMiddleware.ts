import { isRetryableError } from '../../utils/ErrorUtils.js';
import { sleep } from '../../utils/ProcessUtils.js';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  onRetry?: (attempt: number, error: any) => void;
}

export async function withRetry<T>(
  operation: () => Promise<T>, 
  options: RetryOptions = {}
): Promise<T> {
  const { 
    maxRetries = 3, 
    baseDelay = 1000,
    onRetry 
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isRetryable = isRetryableError(error);
      const isLastAttempt = attempt === maxRetries;

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      const delay = baseDelay * Math.pow(3, attempt);
      
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}
