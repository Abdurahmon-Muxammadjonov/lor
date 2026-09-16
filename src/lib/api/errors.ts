export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INVALID_QUANTITY'
  | 'HALF_NOT_ALLOWED'
  | 'INVALID_DISCOUNT'
  | 'MEDICINE_REQUIRED'
  | 'NEGATIVE_PRICE'
  | 'INVALID_MONEY'
  | 'VISIT_CLOSED'
  | 'SHIFT_CLOSED'
  | 'NO_OPEN_SHIFT'
  | 'PRINTER_ERROR'
  | 'INTEGRATION_ERROR'
  | 'INTERNAL';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message?: string,
    public details?: unknown,
  ) {
    super(message ?? code);
    this.name = 'ApiError';
  }

  static unauthorized(msg = 'Avtorizatsiya talab qilinadi') {
    return new ApiError(401, 'UNAUTHORIZED', msg);
  }
  static forbidden(msg = 'Ruxsat yoʻq') {
    return new ApiError(403, 'FORBIDDEN', msg);
  }
  static notFound(msg = 'Topilmadi') {
    return new ApiError(404, 'NOT_FOUND', msg);
  }
  static validation(details?: unknown, msg = 'Maʼlumotlar notoʻgʻri') {
    return new ApiError(400, 'VALIDATION', msg, details);
  }
  static conflict(msg = 'Ziddiyat') {
    return new ApiError(409, 'CONFLICT', msg);
  }
}
