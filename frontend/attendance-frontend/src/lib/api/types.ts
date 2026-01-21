export type ApiErrorResponse = {
  timestamp: string;
  status: number;
  error: string;
  code: string;
  message: string;
  path: string;
};

export class ApiError extends Error {
  public readonly httpStatus: number;
  public readonly code: string;
  public readonly path?: string;
  public readonly raw?: unknown;

  constructor(params: {
    message: string;
    httpStatus: number;
    code: string;
    path?: string;
    raw?: unknown;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.httpStatus = params.httpStatus;
    this.code = params.code;
    this.path = params.path;
    this.raw = params.raw;
  }
}
