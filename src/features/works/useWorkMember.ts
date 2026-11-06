import { useQuery } from '@tanstack/react-query';
import { worksApi } from './api';
import { workKeys } from './layout';

export function useWorkMember() {
  const query = useQuery({
    queryKey: [...workKeys.all, 'me'],
    queryFn: ({ signal }) => worksApi.me(signal),
    retry: false,
    staleTime: 0,
  });
  return { ...query, data: query.error ? undefined : query.data };
}
