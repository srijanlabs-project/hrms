import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Every module spec defines its own {code, message} error catalogue (e.g.
 * INSUFFICIENT_BALANCE, OUTSIDE_GEOFENCE, OFFER_EXCEEDS_BUDGET). AppError is the
 * single shape all of them are thrown through, so every endpoint's error
 * response body is consistently { error: { code, message, field? } }.
 */
export class AppError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
    public readonly field?: string,
  ) {
    super({ error: { code, message, field } }, status);
  }
}

export const AppErrors = {
  badRequest: (code: string, message: string, field?: string) =>
    new AppError(code, message, HttpStatus.BAD_REQUEST, field),
  notFound: (code: string, message: string) => new AppError(code, message, HttpStatus.NOT_FOUND),
  conflict: (code: string, message: string) => new AppError(code, message, HttpStatus.CONFLICT),
  forbidden: (code: string, message: string) => new AppError(code, message, HttpStatus.FORBIDDEN),
  unprocessable: (code: string, message: string, field?: string) =>
    new AppError(code, message, HttpStatus.UNPROCESSABLE_ENTITY, field),
};
