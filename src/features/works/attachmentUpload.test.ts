import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { nativeClient } from './nativeApi';
import { uploadWorkAttachments } from './attachmentUpload';

vi.mock('./nativeApi', () => ({ nativeClient: { post: vi.fn() } }));
const file = new File(['123456'], 'cover.png', { type: 'image/png' });
const descriptor = { id: 0, filename: file.name, file_size: file.size, content_type: file.type, upload_filename: 'owned-upload' };

describe('native work attachment upload', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.unstubAllGlobals());
  it('uses raw storage PUT without auth and strips upload URLs from the durable descriptor', async () => {
    vi.mocked(nativeClient.post).mockResolvedValue({ data: { attachments: [{ ...descriptor, upload_mode: 'singlepart', upload_url: 'https://storage.test/upload' }] } });
    const put = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal('fetch', put);
    expect(await uploadWorkAttachments('123', [file])).toEqual([descriptor]);
    expect(put).toHaveBeenCalledExactlyOnceWith('https://storage.test/upload', expect.objectContaining({ method: 'PUT', body: file, credentials: 'omit', referrerPolicy: 'no-referrer' }));
    expect(put.mock.calls[0][1]).not.toHaveProperty('headers');
  });
  it('uploads ordered multipart slices and completes only after every part succeeds', async () => {
    vi.mocked(nativeClient.post).mockResolvedValueOnce({ data: { attachments: [{ ...descriptor, upload_mode: 'multipart', upload_id: 'multipart', part_size: 3, parts: [{ part_number: 2, upload_url: 'https://storage.test/2' }, { part_number: 1, upload_url: 'https://storage.test/1' }] }] } }).mockResolvedValueOnce({ data: {} });
    const put = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal('fetch', put);
    expect(await uploadWorkAttachments('123', [file])).toEqual([descriptor]);
    expect(put.mock.calls.map(call => call[0])).toEqual(['https://storage.test/1', 'https://storage.test/2']);
    expect(put.mock.calls.map(call => call[1].body.size)).toEqual([3, 3]);
    expect(nativeClient.post).toHaveBeenLastCalledWith('/channels/123/attachments/complete', { uploads: [{ upload_filename: 'owned-upload', upload_id: 'multipart' }] }, { signal: undefined });
  });
  it('does not return usable credentials or complete a failed upload', async () => {
    vi.mocked(nativeClient.post).mockResolvedValue({ data: { attachments: [{ ...descriptor, upload_mode: 'singlepart', upload_url: 'https://storage.test/upload' }] } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(uploadWorkAttachments('123', [file])).rejects.toThrow('403');
    expect(nativeClient.post).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed or reused slot plans before uploading', async () => {
    const put = vi.fn(); vi.stubGlobal('fetch', put);
    vi.mocked(nativeClient.post).mockResolvedValue({ data: { attachments: [{ ...descriptor, id: 8, upload_mode: 'singlepart', upload_url: 'https://storage.test/upload' }] } });
    await expect(uploadWorkAttachments('123', [file])).rejects.toThrow('不一致');
    expect(put).not.toHaveBeenCalled();
    await expect(uploadWorkAttachments('123', [new File(['x'], 'a.txt', {type:'text/plain'})])).rejects.toThrow('图片');
  });
});
