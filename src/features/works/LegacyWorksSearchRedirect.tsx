import { Navigate, useLocation } from 'react-router-dom';

/** Keep old shared search/tag links usable without mounting a second search UI. */
export function LegacyWorksSearchRedirect() {
  const { search, hash } = useLocation();
  const params = new URLSearchParams(search);
  for (const value of params.getAll('tag_id')) {
    for (const id of value.split(/[,，\n]/).map(value => value.trim())) {
      if (/^[1-9][0-9]*$/.test(id)) params.append('include_tag_ids', id);
    }
  }
  params.delete('tag_id');
  const query = params.toString();
  return <Navigate replace to={`/search${query ? `?${query}` : ''}${hash}`} />;
}
