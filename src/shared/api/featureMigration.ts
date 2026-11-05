export const FEATURE_NOT_MIGRATED_MESSAGE = '功能未迁移成功';

/** Only assigned after a separate authentication check confirms the session. */
export class FeatureNotMigratedError extends Error {
  readonly code = 'FEATURE_NOT_MIGRATED';
  constructor() {
    super(FEATURE_NOT_MIGRATED_MESSAGE);
    this.name = 'FeatureNotMigratedError';
  }
}

/** Do not relabel unavailable authentication checks as an expired session or feature. */
export class AuthVerificationUnavailableError extends Error {
  readonly code = 'AUTH_VERIFICATION_UNAVAILABLE';
  constructor() {
    super('暂时无法确认登录状态，请稍后重试');
    this.name = 'AuthVerificationUnavailableError';
  }
}

export function isFeatureNotMigratedError(error: unknown): error is FeatureNotMigratedError {
  return error instanceof FeatureNotMigratedError;
}

export function isAuthVerificationUnavailableError(
  error: unknown,
): error is AuthVerificationUnavailableError {
  return error instanceof AuthVerificationUnavailableError;
}
