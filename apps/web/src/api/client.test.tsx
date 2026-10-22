import { screen, waitFor } from '@testing-library/react';
import { App } from '../App';
import { apiFetch, ApiError } from './client';
import { renderWithProviders } from '../test/render';

const auth = { accessToken: 'tok', staff: { id: 1, displayName: 'Cashier One' }, appEnv: 'dev' };

describe('apiFetch', () => {
  it('on 401 from a protected call clears pos.auth and lands on /login', async () => {
    localStorage.setItem('pos.auth', JSON.stringify(auth));
    const fetchStub = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }),
    );
    vi.stubGlobal('fetch', fetchStub);
    renderWithProviders(<App />, { route: '/' });
    expect(await screen.findByRole('heading', { name: 'New order' })).toBeInTheDocument();

    await expect(apiFetch('/auth/me')).rejects.toBeInstanceOf(ApiError);

    // PosPage also fetches the public /menu, so find the protected call by path.
    const me = fetchStub.mock.calls.find(([url]) => String(url).endsWith('/auth/me'))!;
    expect(me[1].headers.Authorization).toBe('Bearer tok');
    expect(localStorage.getItem('pos.auth')).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Staff sign in' })).toBeInTheDocument(),
    );
  });
});
