import { isValidElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { matchRoutes, Navigate, type RouteObject } from 'react-router-dom';

vi.mock('@/shared/config/works', () => ({ worksV2Enabled: true }));
vi.mock('@/widgets/layout/RootLayout', () => ({ RootLayout: () => null }));
vi.mock('@/app/providers/ProtectedRoute', () => ({ ProtectedRoute: () => null }));
vi.mock('@/app/providers/RequiredSetupGate', () => ({ RequiredSetupGate: () => null }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  createBrowserRouter: (routes: unknown) => ({ routes }),
}));
import { router } from './router';

describe('retired duplicate works routes', () => {
  it.each([
    ['/works/discover', '/'],
    ['/works/collection', '/me?tab=booklists'],
    ['/works/me', '/me?tab=preferences'],
    ['/works/follows', '/me?tab=follows'],
    ['/works/notifications', '/activity'],
    ['/works/booklists', '/booklists'],
  ])('%s redirects to the existing page %s', (path, destination) => {
    const element = matchRoutes<RouteObject>(router.routes, path)?.slice(-1)[0]?.route.element;
    expect(isValidElement(element)).toBe(true);
    if (!isValidElement<{ to: string; replace: boolean }>(element)) throw new Error('Missing route');
    expect(element.type).toBe(Navigate);
    expect(element.props.to).toBe(destination);
    expect(element.props.replace).toBe(true);
  });
  it.each(['/publish', '/works/123', '/works/123/cards', '/works/123/edit', '/works/users/123', '/works/booklists/123', '/activity'])('keeps existing functionality at %s', path => {
    const route = matchRoutes<RouteObject>(router.routes, path)?.slice(-1)[0]?.route;
    expect(route?.path).not.toBe('*');
    expect(route?.element).toBeTruthy();
  });
  it('retires the hidden-work admin route without registering another management page', () => {
    expect(matchRoutes<RouteObject>(router.routes, '/works/admin/deleted')?.slice(-1)[0]?.route.path).toBe('*');
  });
});
