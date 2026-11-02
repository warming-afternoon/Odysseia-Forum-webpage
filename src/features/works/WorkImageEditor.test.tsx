import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { WorkImageEditor, type WorkImageEntry } from './WorkImageEditor';

function Harness() {
  const [entries, change] = useState<WorkImageEntry[]>([{key:'a',attachment:{id:'9007199254740993',url:'https://cdn.test/a',filename:'a.png',content_type:'image/png'}},{key:'b',attachment:{id:'9007199254740994',url:'https://cdn.test/b',filename:'b.png',content_type:'image/png'}}]);
  return <><WorkImageEditor entries={entries} change={change} disabled={false}/><output>{JSON.stringify(entries.map(entry => 'attachment' in entry ? entry.attachment.id : entry.file.name))}</output></>;
}
describe('work native image order', () => {
  it('preserves snowflake references while sorting and removing existing attachments', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button',{name:'上移图片 2'}));
    expect(screen.getByRole('status').textContent).toBe('["9007199254740994","9007199254740993"]');
    fireEvent.click(screen.getByRole('button',{name:'移除图片 1'}));
    expect(screen.getByRole('status').textContent).toBe('["9007199254740993"]');
    fireEvent.change(screen.getByLabelText('添加作品图片'),{target:{files:[new File(['x'],'new.png',{type:'image/png'})]}});
    expect(screen.getByRole('status').textContent).toBe('["9007199254740993","new.png"]');
  });
});
