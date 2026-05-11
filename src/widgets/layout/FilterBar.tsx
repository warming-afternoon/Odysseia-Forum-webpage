import { Select } from '@/shared/ui/Select';

interface FilterBarProps {
  timeFrom: string;
  timeTo: string;
  sortMethod: string;
  tagLogic: 'and' | 'or';
  onTimeFromChange: (value: string) => void;
  onTimeToChange: (value: string) => void;
  onSortMethodChange: (value: string) => void;
  onTagLogicChange: (value: 'and' | 'or') => void;
}

const sortOptions = [
  { value: 'relevance', label: '相关度' },
  { value: 'last_active_desc', label: '最近活跃 ↓' },
  { value: 'created_desc', label: '最新发布 ↓' },
  { value: 'reply_desc', label: '回复数 ↓' },
  { value: 'reaction_desc', label: '反应数 ↓' },
];

const tagLogicOptions = [
  { value: 'and', label: '全部包含 (AND)' },
  { value: 'or', label: '任一即可 (OR)' },
];

export function FilterBar({
  timeFrom,
  timeTo,
  sortMethod,
  tagLogic,
  onTimeFromChange,
  onTimeToChange,
  onSortMethodChange,
  onTagLogicChange,
}: FilterBarProps) {
  return (
    // 由外层容器控制左右间距，这里只负责行内布局
    <div className="mb-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {/* 发帖不早于 */}
        <div>
          <label
            htmlFor="timeFrom"
            className="mb-1.5 block text-xs font-medium text-(--od-text-secondary)"
          >
            发帖不早于
          </label>
          <input
            id="timeFrom"
            type="date"
            value={timeFrom}
            onChange={(e) => onTimeFromChange(e.target.value)}
            className="w-full rounded-md border-none bg-(--od-bg-tertiary) px-3 py-2 text-sm text-(--od-text-primary) transition-all duration-200 focus:outline-hidden focus:ring-2 focus:ring-(--od-accent)"
          />
        </div>

        {/* 发帖不晚于 */}
        <div>
          <label
            htmlFor="timeTo"
            className="mb-1.5 block text-xs font-medium text-(--od-text-secondary)"
          >
            发帖不晚于
          </label>
          <input
            id="timeTo"
            type="date"
            value={timeTo}
            onChange={(e) => onTimeToChange(e.target.value)}
            className="w-full rounded-md border-none bg-(--od-bg-tertiary) px-3 py-2 text-sm text-(--od-text-primary) transition-all duration-200 focus:outline-hidden focus:ring-2 focus:ring-(--od-accent)"
          />
        </div>

        {/* 排序方式 */}
        <div>
          <label
            htmlFor="sortMethod"
            className="mb-1.5 block text-xs font-medium text-(--od-text-secondary)"
          >
            排序方式
          </label>
          <Select
            id="sortMethod"
            value={sortMethod}
            options={sortOptions}
            onChange={onSortMethodChange}
          />
        </div>

        {/* 标签逻辑 */}
        <div>
          <label
            htmlFor="tagLogic"
            className="mb-1.5 block text-xs font-medium text-(--od-text-secondary)"
          >
            标签逻辑
          </label>
          <Select
            id="tagLogic"
            value={tagLogic}
            options={tagLogicOptions}
            onChange={(v) => onTagLogicChange(v as 'and' | 'or')}
          />
        </div>
      </div>
    </div>
  );
}
