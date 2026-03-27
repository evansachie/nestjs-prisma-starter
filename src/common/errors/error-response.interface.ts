import type { ErrorCode } from './error-codes';

export interface ValidationDetail {
  field: string;
  message: string;
}

export interface ErrorResponseBody {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: ValidationDetail[];
}

export interface StandardErrorResponse {
  success: false;
  error: ErrorResponseBody;
  _debug?: {
    stack?: string;
    metadata?: Record<string, unknown>;
  };
}
