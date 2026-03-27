import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError } from './app-error';
import { ErrorCode } from './error-codes';
import type { StandardErrorResponse } from './error-response.interface';
import { IntegrationError } from './integration-error';

const httpStatusToErrorCode: Partial<Record<HttpStatus, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.AUTH_TOKEN_MISSING,
  [HttpStatus.FORBIDDEN]: ErrorCode.AUTH_FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.RESOURCE_NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.RESOURCE_ALREADY_EXISTS,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.OTP_RATE_LIMITED,
  [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCode.INTERNAL_ERROR,
  [HttpStatus.BAD_GATEWAY]: ErrorCode.INTEGRATION_ERROR,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.INTEGRATION_UNAVAILABLE,
  [HttpStatus.GATEWAY_TIMEOUT]: ErrorCode.INTEGRATION_TIMEOUT,
};

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProduction = process.env.NODE_ENV === 'production';

    const errorResponse = this.buildErrorResponse(exception, isProduction);
    const statusCode = errorResponse.error.statusCode;

    if (statusCode >= 500) {
      this.logger.error(
        `[${errorResponse.error.code}] ${errorResponse.error.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${errorResponse.error.code}] ${errorResponse.error.message} — ${request.method} ${request.url}`,
      );
    }

    response.status(statusCode).json(errorResponse);
  }

  private buildErrorResponse(
    exception: unknown,
    isProduction: boolean,
  ): StandardErrorResponse {
    if (exception instanceof AppError) {
      return this.fromAppError(exception, isProduction);
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception, isProduction);
    }

    return this.fromUnknown(exception, isProduction);
  }

  private fromAppError(
    error: AppError,
    isProduction: boolean,
  ): StandardErrorResponse {
    const isIntegration = error instanceof IntegrationError;

    const result: StandardErrorResponse = {
      success: false,
      error: {
        code: error.errorCode,
        message: error.message,
        statusCode: error.getStatus(),
        ...(error.details?.length ? { details: error.details } : {}),
      },
    };

    if (!isProduction) {
      const metadata: Record<string, unknown> = { ...error.metadata };
      if (isIntegration) {
        metadata.integration = error.integrationContext;
      }
      result._debug = {
        stack: error.stack,
        ...(Object.keys(metadata).length ? { metadata } : {}),
      };
    }

    return result;
  }

  private fromHttpException(
    exception: HttpException,
    isProduction: boolean,
  ): StandardErrorResponse {
    const status = exception.getStatus();
    const code =
      httpStatusToErrorCode[status as HttpStatus] ?? ErrorCode.INTERNAL_ERROR;

    const exceptionResponse = exception.getResponse();
    let message: string;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const resp = exceptionResponse as Record<string, unknown>;
      if (Array.isArray(resp.message)) {
        message = (resp.message as string[]).join('; ');
      } else {
        message =
          typeof resp.message === 'string'
            ? resp.message
            : ((resp.error as string) ?? exception.message);
      }
    } else {
      message = exception.message;
    }

    const result: StandardErrorResponse = {
      success: false,
      error: { code, message, statusCode: status },
    };

    if (!isProduction) {
      result._debug = { stack: exception.stack };
    }

    return result;
  }

  private fromUnknown(
    exception: unknown,
    isProduction: boolean,
  ): StandardErrorResponse {
    const message = isProduction
      ? 'An unexpected error occurred'
      : exception instanceof Error
        ? exception.message
        : 'An unexpected error occurred';

    const result: StandardErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
    };

    if (!isProduction && exception instanceof Error) {
      result._debug = { stack: exception.stack };
    }

    return result;
  }
}
