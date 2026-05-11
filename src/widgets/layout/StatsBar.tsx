import { Grid, List } from 'lucide-react';
import { useSettings } from '@/shared/hooks/useSettings';
import { Select } from '@/shared/ui/Select';

interface StatsBarProps {
  totalCount: number;
  perPage: number;
  currentPage?: number;
  totalPages?: number;
  onPerPageChange: (value: number) => void;
}

export function StatsBar({
  totalCount,
  perPage,
  currentPage,
  totalPages,
  onPerPageChange,
}: StatsBarProps) {
  const { settings, updateSettings } = useSettings();
  const { openMode, layoutMode } = settings;

  return (
    <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      {/* 结果统计 */}
      <div className="text-sm text-(--od-text-secondary)">
        共 <span className="font-semibold text-(--od-text-primary)">{totalCount}</span> 条结果
        {typeof currentPage === 'number' &&
          typeof totalPages === 'number' &&
          totalPages > 0 && (
            <span className="ml-2 text-xs text-(--od-text-tertiary)">
              第 {currentPage} / {totalPages} 页
            </span>
          )}
      </div>

      {/* 控制选项 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 布局切换 */}
        <div className="flex items-center gap-1 rounded-md bg-(--od-bg-secondary) p-1">
          <button
            onClick={() => updateSettings({ layoutMode: 'grid' })}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${layoutMode === 'grid'
              ? 'bg-(--od-accent) text-white'
              : 'text-(--od-text-secondary) hover:bg-(--od-bg-tertiary) hover:text-(--od-text-primary)'
              }`}
            title="网格布局"
          >
            <Grid className="h-3.5 w-3.5" />
            <span>网格</span>
          </button>
          <button
            onClick={() => updateSettings({ layoutMode: 'list' })}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${layoutMode === 'list'
              ? 'bg-(--od-accent) text-white'
              : 'text-(--od-text-secondary) hover:bg-(--od-bg-tertiary) hover:text-(--od-text-primary)'
              }`}
            title="列表布局"
          >
            <List className="h-3.5 w-3.5" />
            <span>列表</span>
          </button>
        </div>

        {/* 每页显示数量 */}
        <div className="flex items-center gap-2">
          <label htmlFor="perPage" className="text-xs text-(--od-text-secondary)">
            每页
          </label>
          <Select
            id="perPage"
            value={String(perPage)}
            options={[
              { value: '12', label: '12' },
              { value: '24', label: '24' },
              { value: '48', label: '48' },
            ]}
            onChange={(v) => {
              const num = Number(v);
              onPerPageChange(Number.isNaN(num) ? 24 : num);
            }}
          />
        </div>

        {/* 跳转方式 */}
        <div className="flex items-center gap-2">
          <label htmlFor="openMode" className="text-xs text-(--od-text-secondary)">
            跳转方式
          </label>
          <Select
            id="openMode"
            value={openMode}
            options={[
              { value: 'app', label: 'App' },
              { value: 'web', label: '网页' },
            ]}
            onChange={(v) => updateSettings({ openMode: v as 'app' | 'web' })}
          />
        </div>
      </div>
    </div>
  );
}
