import type { NativeMessage } from './nativeApi';

export type WorkImageEntry = { key: string; attachment: NativeMessage['attachments'][number] } | { key: string; file: File };

/** 管理原生附件的保留、移除和顺序，首张图片自然成为作品封面。 */
export function WorkImageEditor({ entries, change, disabled }: { entries: WorkImageEntry[]; change: (entries: WorkImageEntry[]) => void; disabled: boolean }) {
  function move(index: number, direction: number) {
    const next = [...entries];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    change(next);
  }
  return <fieldset disabled={disabled} className="grid gap-2"><legend>作品图片（首图作为封面）</legend>
    <input aria-label="添加作品图片" type="file" accept="image/*" multiple onChange={event => {
      const files = Array.from(event.target.files || []);
      change([...entries, ...files.map(file => ({ key: crypto.randomUUID(), file }))]);
      event.target.value = '';
    }} />
    <ol className="grid gap-2">{entries.map((entry, index) => <li key={entry.key} className="flex items-center gap-2">
      {'attachment' in entry && entry.attachment.content_type?.startsWith('image/') && <img src={entry.attachment.url} alt="" className="h-16 w-16 object-cover" />}
      <span>{'file' in entry ? entry.file.name : entry.attachment.filename}{index === 0 ? '（首图）' : ''}</span>
      <button type="button" aria-label={`上移图片 ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}>上移</button>
      <button type="button" aria-label={`下移图片 ${index + 1}`} disabled={index === entries.length - 1} onClick={() => move(index, 1)}>下移</button>
      <button type="button" aria-label={`移除图片 ${index + 1}`} onClick={() => change(entries.filter((_, position) => position !== index))}>移除</button>
    </li>)}</ol>
    {entries.length > 10 && <p role="alert">最多上传 10 张图片，请移除多余图片。</p>}
  </fieldset>;
}
