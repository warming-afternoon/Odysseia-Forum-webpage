import { useQuery } from '@tanstack/react-query';
import { worksApi } from './api';
import { workKeys } from './layout';

export function useWorkMember() {
  return useQuery({ queryKey: [...workKeys.all, 'me'], queryFn: ({ signal }) => worksApi.me(signal), retry: false, staleTime: 0 });
}
