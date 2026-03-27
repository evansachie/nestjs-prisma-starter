import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, errorCodeToHttpStatus } from './error-codes';
import type { ValidationDetail } from './error-response.interface';

export class AppError extends HttpException {
  readonly errorCode: ErrorCode;
  readonly details?: ValidationDetail[];
  readonly metadata?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode?: HttpStatus,
    options?: {
      details?: ValidationDetail[];
      metadata?: Record<string, unknown>;
      cause?: Error;
    },
  ) {
    const status = statusCode ?? errorCodeToHttpStatus[code];
    super(message, status, { cause: options?.cause });
    this.errorCode = code;
    this.details = options?.details;
    this.metadata = options?.metadata;
  }

  static from(code: ErrorCode, message: string, cause?: Error): AppError {
    return new AppError(code, message, undefined, { cause });
  }

  static internal(message: string, cause?: Error): AppError {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, undefined, {
      cause,
    });
  }

  static notFound(resource: string, id?: string): AppError {
    const message = id
      ? `${resource} '${id}' not found`
      : `${resource} not found`;
    return new AppError(ErrorCode.RESOURCE_NOT_FOUND, message);
  }

  static alreadyExists(resource: string, identifier?: string): AppError {
    const message = identifier
      ? `${resource} '${identifier}' already exists`
      : `${resource} already exists`;
    return new AppError(ErrorCode.RESOURCE_ALREADY_EXISTS, message);
  }

  static validation(message: string, details?: ValidationDetail[]): AppError {
    return new AppError(ErrorCode.VALIDATION_FAILED, message, undefined, {
      details,
    });
  }

  static tokenMissing(): AppError {
    return new AppError(
      ErrorCode.AUTH_TOKEN_MISSING,
      'Authentication token is required',
    );
  }

  static sessionExpired(): AppError {
    return new AppError(
      ErrorCode.AUTH_TOKEN_EXPIRED,
      'Session has expired, please log in again',
    );
  }

  static invalidCredentials(message = 'Invalid credentials'): AppError {
    return new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, message);
  }

  static forbidden(
    message = 'You do not have permission to perform this action',
  ): AppError {
    return new AppError(ErrorCode.AUTH_FORBIDDEN, message);
  }

  static accountSuspended(): AppError {
    return new AppError(
      ErrorCode.AUTH_ACCOUNT_SUSPENDED,
      'Account has been suspended',
    );
  }

  static otpInvalid(): AppError {
    return new AppError(ErrorCode.OTP_INVALID, 'Invalid OTP');
  }

  static otpExpired(): AppError {
    return new AppError(ErrorCode.OTP_EXPIRED, 'OTP has expired');
  }

  static otpRateLimited(): AppError {
    return new AppError(
      ErrorCode.OTP_RATE_LIMITED,
      'Please wait before requesting another code',
    );
  }

  static userNotFound(): AppError {
    return new AppError(ErrorCode.USER_NOT_FOUND, 'User not found');
  }

  static pinAlreadySet(): AppError {
    return new AppError(
      ErrorCode.PIN_ALREADY_SET,
      'PIN already set. Use Change PIN to update.',
    );
  }

  static pinLocked(): AppError {
    return new AppError(
      ErrorCode.PIN_LOCKED,
      'Account is temporarily locked due to too many failed attempts',
    );
  }
}
