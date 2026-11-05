import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { authorsApi } from '@/features/authors/api/authorsApi';
import { PageStatusMessage } from '@/shared/ui/PageStatusMessage';
import { captureAuthSession } from '@/shared/lib/authSession';

/** Legacy routes never guess that a Discord ID is a canonical author ID. */
export function LegacyAuthorRedirect({ discordId }: { discordId: string }) {
  const location = useLocation();
  const valid = /^\d+$/.test(discordId);
  const query = useQuery({
    queryKey: ['authors', 'legacy-discord', captureAuthSession().generation, discordId],
    queryFn: ({ signal }) => authorsApi.resolveLegacyAuthor(discordId, signal),
    enabled: valid, retry: false, staleTime: 0,
  });
  if (!valid || query.error) return <PageStatusMessage tone="error">旧作者链接已失效或当前不可访问</PageStatusMessage>;
  if (query.isPending || query.isFetching || !query.data) return <PageStatusMessage>正在查找作者...</PageStatusMessage>;
  return <Navigate replace to={`/works/users/${encodeURIComponent(query.data)}${location.search}${location.hash}`} />;
}
