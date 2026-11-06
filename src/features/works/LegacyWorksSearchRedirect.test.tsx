import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LegacyWorksSearchRedirect } from './LegacyWorksSearchRedirect';

afterEach(cleanup);
function Destination() { const location = useLocation(); return <output>{location.pathname}{location.search}{location.hash}</output>; }
it('retires the duplicate search while preserving text and exact tag IDs', () => {
  render(<MemoryRouter initialEntries={['/works?q=hello&tag_id=90071992547409931,2#tags']}><Routes><Route path="/works" element={<LegacyWorksSearchRedirect />} /><Route path="/search" element={<Destination />} /></Routes></MemoryRouter>);
  expect(screen.getByRole('status').textContent).toBe('/search?q=hello&include_tag_ids=90071992547409931&include_tag_ids=2#tags');
});
it('redirects the plain works landing page to the existing search', () => {
  render(<MemoryRouter initialEntries={['/works']}><Routes><Route path="/works" element={<LegacyWorksSearchRedirect />} /><Route path="/search" element={<Destination />} /></Routes></MemoryRouter>);
  expect(screen.getByRole('status').textContent).toBe('/search');
});
