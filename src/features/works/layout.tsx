import type { ReactNode } from 'react';
import { useWorkMember } from './member';
import { WorkStatus } from './components';

export const workKeys = { all: ['works-v2'] as const };

/** Shared permission boundary for standalone editing, with no duplicate navigation. */
export function WorkPageFrame({ children }: { children: ReactNode }) {
  const member = useWorkMember();
  if (member.error) return <WorkStatus pending={member.isPending} error={member.error} />;
  return <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">{children}</div>;
}
