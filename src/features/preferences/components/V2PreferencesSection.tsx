import { useAuth } from '@/features/auth/hooks/useAuth';
import { captureAuthSession } from '@/shared/lib/authSession';
import { useRef, useState, type FormEvent } from 'react';
import { useUserPreferences } from '../hooks/useUserPreferences';
import {
  preferenceFormValues,
  preferencePatch,
  preferenceSortOptions,
  type PreferenceDraft,
  type PreferenceField,
} from '../lib/v2PreferencesForm';
import { GUILD_ID } from '@/shared/config/channelCategories.private';
import { workError } from '@/features/works/components';

const inputClass = 'w-full rounded border bg-transparent p-2';
const textFields: { name: PreferenceField; label: string; hint: string }[] = [
  {
    name: 'preferred_channels',
    label: '偏好频道（Discord 来源频道 ID）',
    hint: '保留旧偏好语义，仅筛选旧 Discord 来源频道。不是 Fluxer 频道 ID；留空表示不限。',
  },
  {
    name: 'include_authors',
    label: '包含作者（Fluxer 用户 ID）',
    hint: '使用作品作者的 Fluxer 用户 ID，不要填写 Discord ID。留空表示不限作者。',
  },
  {
    name: 'exclude_authors',
    label: '排除作者（Fluxer 用户 ID）',
    hint: '多个 ID 用逗号或换行分隔。',
  },
  { name: 'include_tags', label: '包含标签', hint: '填写标签名称，多个标签用逗号或换行分隔。' },
  { name: 'exclude_tags', label: '排除标签', hint: '填写不希望看到的标签名称。' },
  {
    name: 'include_keywords',
    label: '包含关键词',
    hint: '逗号表示且（AND），斜杠表示或（OR），双引号表示精确匹配。',
  },
  { name: 'exclude_keywords', label: '排除关键词', hint: '填写需要排除的关键词。' },
  {
    name: 'exclude_keyword_exemption_markers',
    label: '排除词豁免标记',
    hint: '例如：禁, 🈲。用逗号或换行分隔，留空取消豁免标记。',
  },
];
const times = [
  ['created_after', '发布于此时间之后'],
  ['created_before', '发布于此时间之前'],
  ['active_after', '活跃于此时间之后'],
  ['active_before', '活跃于此时间之前'],
] as const;

type V2PreferencesSectionProps = { userId?: string; onSaved?: () => void; submitLabel?: string };

export function V2PreferencesSection(props: V2PreferencesSectionProps) {
  const { user } = useAuth();
  const userId = props.userId || user?.id;
  const { generation } = captureAuthSession();
  // Remount editable state before rendering a different account or login session.
  return <V2PreferencesForm key={`v2:${generation}:${userId || ''}`} {...props} userId={userId} />;
}

function V2PreferencesForm({
  userId,
  onSaved,
  submitLabel = '保存偏好',
}: V2PreferencesSectionProps) {
  const query = useUserPreferences({ guildId: GUILD_ID, mode: 'v2', userId });
  const [draft, setDraft] = useState<PreferenceDraft>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const saving = useRef(false);
  const preferences = query.preferences;
  const dirty = Object.keys(draft).length > 0;
  function change(name: PreferenceField, value: string) {
    setDraft((current) => {
      const next = { ...current, [name]: value };
      if (preferences && value === preferenceFormValues(preferences)[name]) delete next[name];
      return next;
    });
    setSaved(false);
    setError('');
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving.current || !preferences || query.isLoading || query.isError) return;
    setError('');
    try {
      const patch = preferencePatch(draft);
      // Saving the displayed defaults is a real first setup, not an empty PATCH.
      if (!Object.keys(patch).length && query.isFirstTime)
        patch.ui_page_size = preferences.ui_page_size;
      if (!Object.keys(patch).length) return;
      saving.current = true;
      await query.savePreferences(patch);
      setDraft({});
      setSaved(true);
      onSaved?.();
    } catch (failure) {
      setError(workError(failure));
    } finally {
      saving.current = false;
    }
  }
  if (query.isLoading) return <p role="status">正在加载偏好设置…</p>;
  if (!preferences || query.isError)
    return (
      <section aria-label="发现偏好">
        <p role="alert">暂时无法读取偏好设置。{query.error ? workError(query.error) : ''}</p>
        <button type="button" onClick={() => void query.refetch()} className="underline">
          重新读取偏好
        </button>
      </section>
    );
  const values = { ...preferenceFormValues(preferences), ...draft };
  return (
    <section aria-labelledby="v2-preferences-title" className="my-5 rounded border p-4">
      <h2 id="v2-preferences-title" className="mb-2 text-xl">
        发现偏好
      </h2>
      {query.isFirstTime && (
        <p className="mb-4 text-sm" role="status">
          首次设置：当前显示默认值，保存后才会应用到你的账号。
        </p>
      )}
      <p className="mb-4 text-sm">
        搜索未指定筛选条件时使用这些偏好。NSFW 可见性在个人页单独设置。
      </p>
      {(preferences.results_per_page < 1 ||
        preferences.results_per_page > 9 ||
        preferences.ui_page_size < 1 ||
        preferences.ui_page_size > 100) && (
        <p className="mb-4 text-sm">已保存的旧分页值超出新范围，可修改后保存；未修改项会保留。</p>
      )}
      <form noValidate onSubmit={(event) => void save(event)}>
        <fieldset disabled={query.isSaving} className="grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">搜索与显示偏好</legend>
          {textFields.map(({ name, label, hint }) => (
            <label className="grid gap-1 text-sm" key={name}>
              <span>{label}</span>
              <textarea
                className={inputClass}
                value={values[name]}
                onChange={(event) => change(name, event.target.value)}
              />
              <span className="text-xs text-(--od-text-secondary)">{hint}</span>
            </label>
          ))}
          <label className="grid gap-1 text-sm">
            预览图片
            <select
              className={inputClass}
              value={values.preview_image_mode}
              onChange={(event) => change('preview_image_mode', event.target.value)}
            >
              <option value="thumbnail">缩略图</option>
              <option value="full">完整图</option>
              <option value="none">不显示</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            BOT 每页条数
            <input
              className={inputClass}
              type="number"
              min={1}
              max={9}
              step={1}
              required
              value={values.results_per_page}
              onChange={(event) => change('results_per_page', event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            网页每页条数
            <input
              className={inputClass}
              type="number"
              min={1}
              max={100}
              step={1}
              required
              value={values.ui_page_size}
              onChange={(event) => change('ui_page_size', event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            默认排序
            <select
              className={inputClass}
              value={values.sort_method}
              onChange={(event) => change('sort_method', event.target.value)}
            >
              {preferenceSortOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            自定义排序基础
            <select
              className={inputClass}
              value={values.custom_base_sort}
              onChange={(event) => change('custom_base_sort', event.target.value)}
            >
              {preferenceSortOptions
                .filter(([value]) => value !== 'custom')
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          {times.map(([name, label]) => (
            <label className="grid gap-1 text-sm" key={name}>
              {label}
              <input
                className={inputClass}
                value={values[name]}
                placeholder="YYYY-MM-DD 或 -7d；留空不限"
                onChange={(event) => change(name, event.target.value)}
              />
            </label>
          ))}
        </fieldset>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={query.isSaving || (!dirty && !query.isFirstTime)}
            className="rounded border px-4 py-2 disabled:opacity-50"
          >
            {query.isSaving ? '保存中…' : submitLabel}
          </button>
          {dirty && (
            <button
              type="button"
              disabled={query.isSaving}
              className="underline"
              onClick={() => {
                setDraft({});
                setError('');
              }}
            >
              放弃修改
            </button>
          )}
          <span role="status">
            {query.isSaving
              ? '正在保存偏好…'
              : saved
                ? '偏好已保存'
                : dirty
                  ? '有未保存修改'
                  : query.isFetching
                    ? '正在同步偏好…'
                    : '已同步'}
          </span>
        </div>
        {error && (
          <p role="alert" className="mt-3">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
