import { HttpStatus } from '@nestjs/common';
import { AppError } from './app-error';
import { ErrorCode } from './error-codes';

interface AxiosLikeError extends Error {
  isAxiosError?: boolean;
  response?: {
    status?: number;
    data?: unknown;
  };
  config?: {
    url?: string;
    method?: string;
  };
  code?: string;
}

export interface IntegrationContext {
  provider: string;
  providerStatusCode?: number;
  providerResponse?: Record<string, unknown>;
  requestUrl?: string;
  requestMethod?: string;
}

export class IntegrationError extends AppError {
  readonly integrationContext: IntegrationContext;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: HttpStatus,
    integrationContext: IntegrationContext,
    cause?: Error,
  ) {
    super(code, message, statusCode, { cause });
    this.integrationContext = integrationContext;
  }

  static fromAxios(
    provider: string,
    error: AxiosLikeError | Error,
    message?: string,
  ): IntegrationError {
    const axiosErr = error as AxiosLikeError;
    const isAxios = axiosErr.isAxiosError === true || 'isAxiosError' in error;

    if (!isAxios) {
      return new IntegrationError(
        ErrorCode.INTEGRATION_ERROR,
        message ?? 'A third-party service error occurred',
        HttpStatus.BAD_GATEWAY,
        { provider },
        error,
      );
    }

    const responseData = axiosErr.response?.data as
      | Record<string, unknown>
      | undefined;

    const context: IntegrationContext = {
      provider,
      providerStatusCode: axiosErr.response?.status,
      providerResponse: responseData,
      requestUrl: axiosErr.config?.url,
      requestMethod: axiosErr.config?.method?.toUpperCase(),
    };

    let code = ErrorCode.INTEGRATION_ERROR;
    let status = HttpStatus.BAD_GATEWAY;

    if (axiosErr.code === 'ECONNABORTED' || axiosErr.code === 'ETIMEDOUT') {
      code = ErrorCode.INTEGRATION_TIMEOUT;
      status = HttpStatus.GATEWAY_TIMEOUT;
    } else if (
      axiosErr.code === 'ECONNREFUSED' ||
      axiosErr.code === 'ENOTFOUND'
    ) {
      code = ErrorCode.INTEGRATION_UNAVAILABLE;
      status = HttpStatus.SERVICE_UNAVAILABLE;
    }

    return new IntegrationError(
      code,
      message ?? 'A third-party service error occurred',
      status,
      context,
      error,
    );
  }
}
