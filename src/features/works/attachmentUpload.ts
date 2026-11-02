import { nativeClient } from './nativeApi';
import type { UploadedWorkAttachment } from './types';

type UploadPlan = UploadedWorkAttachment & ({ upload_mode: 'singlepart'; upload_url: string } | { upload_mode: 'multipart'; upload_id: string; part_size: number; parts: { part_number: number; upload_url: string }[] });

/** 使用原生预上传计划传输文件，存储请求不携带登录凭据。 */
export async function uploadWorkAttachments(channelId: string, files: File[], signal?: AbortSignal): Promise<UploadedWorkAttachment[]> {
  if (files.length > 10 || files.some(file => !file.type.startsWith('image/'))) throw new Error('请选择最多 10 张图片');
  if (!files.length) return [];
  const path = `/channels/${encodeURIComponent(channelId)}/attachments`;
  const { data } = await nativeClient.post<{ attachments: UploadPlan[] }>(path, { attachments: files.map((file, id) => ({ id, filename: file.name, file_size: file.size, content_type: file.type })) }, { signal });
  if (data.attachments.length !== files.length || new Set(data.attachments.map(plan => plan.id)).size !== files.length) throw new Error('上传计划与图片不一致');
  const result: UploadedWorkAttachment[] = [];
  for (const plan of [...data.attachments].sort((a, b) => a.id - b.id)) {
    const file = files[plan.id];
    if (!file || plan.filename !== file.name || plan.file_size !== file.size) throw new Error('上传计划与图片不一致');
    const put = async (url: string, body: Blob) => {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('无效上传地址');
      const response = await fetch(url, { method: 'PUT', body, credentials: 'omit', referrerPolicy: 'no-referrer', signal });
      if (!response.ok) throw new Error(`图片上传失败 (${response.status})`);
    };
    if (plan.upload_mode === 'singlepart') await put(plan.upload_url, file);
    else {
      if (plan.part_size <= 0 || plan.parts.length !== Math.ceil(file.size / plan.part_size)) throw new Error('分片上传计划不完整');
      const parts = [...plan.parts].sort((a, b) => a.part_number - b.part_number);
      for (const [index, part] of parts.entries()) {
        if (part.part_number !== index + 1) throw new Error('分片上传顺序无效');
        await put(part.upload_url, file.slice(index * plan.part_size, (index + 1) * plan.part_size));
      }
      await nativeClient.post(`${path}/complete`, { uploads: [{ upload_filename: plan.upload_filename, upload_id: plan.upload_id }] }, { signal });
    }
    result.push({ id: plan.id, filename: plan.filename, file_size: plan.file_size, content_type: plan.content_type, upload_filename: plan.upload_filename });
  }
  return result;
}
