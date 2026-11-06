import { describe, expect, it } from 'vitest';
import { workError } from './components';
const failure = (status: number, data: unknown) => ({ isAxiosError: true, message: 'Axios fallback', response: { status, data } });
describe('Forum and Fluxer error envelopes', () => {
  it('preserves Forum detail strings and messages', () => {
    expect(workError(failure(404, { detail: '作品已删除' }))).toBe('作品已删除');
    expect(workError(failure(400, { detail: { message: '偏好版本冲突' } }))).toBe('偏好版本冲突');
  });
  it('preserves native permission, not-found, validation and upload errors', () => {
    expect(workError(failure(403, { code: 'MISSING_PERMISSIONS', message: 'Missing permissions' }))).toContain('Missing permissions；错误码：MISSING_PERMISSIONS');
    expect(workError(failure(404, { code: 'UNKNOWN_CHANNEL', message: 'Unknown channel' }))).toContain('频道或消息不存在');
    expect(workError(failure(400, { code: 'INVALID_FORM_BODY', errors: [{ path: 'nonce', code: 'TOO_LONG', message: 'Must be at most 32 characters' }] }))).toContain('nonce：Must be at most 32 characters：TOO_LONG');
    expect(workError(failure(400, { code: 'UPLOAD_DISABLED', message: 'Uploads are disabled' }))).toContain('Uploads are disabled');
  });
  it('shows rounded-up retry seconds without automatically retrying', () => {
    expect(workError(failure(429, { code: 'RATE_LIMITED', message: 'Rate limited', retry_after: 1.2 }))).toContain('2 秒后重试');
  });
  it('handles malformed bodies and ordinary errors', () => {
    expect(workError(new Error('离线'))).toBe('离线');
    expect(workError(failure(404, null))).toBe('内容不存在或当前不可见');
    expect(workError(failure(400, { detail: { message: {} } }))).not.toContain('[object Object]');
  });
});
