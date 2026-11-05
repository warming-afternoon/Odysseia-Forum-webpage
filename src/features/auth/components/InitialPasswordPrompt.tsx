import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { acceptFluxerToken, fluxerRequest, getPasswordSetupProof } from '../api/fluxerAuthApi';
import { FluxerLoginIdentity } from './FluxerLoginIdentity';
import {
  captureAuthSession,
  isAuthSessionCurrent,
  subscribeAuthInvalidation,
} from '@/shared/lib/authSession';

/** 仅在新鲜 Discord 登录提供短期证明时提示设置原生密码。 */
export function InitialPasswordPrompt() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(() => Boolean(getPasswordSetupProof()));
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(
    () =>
      subscribeAuthInvalidation(() => {
        setOpen(false);
        setPassword('');
        setConfirmation('');
        setCode('');
      }),
    [],
  );

  if (!open) return null;

  const submit = async (event?: FormEvent, securityKey = false) => {
    event?.preventDefault();
    if (busy) return;
    if (password !== confirmation) {
      setError('两次输入的密码不一致');
      return;
    }
    const proof = getPasswordSetupProof();
    const session = captureAuthSession();
    const token = session.token;
    if (!proof || !token) {
      setError('设置凭证已过期，请重新通过 Discord 登录后再设置。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const verification: Record<string, unknown> = code
        ? { mfa_method: 'totp', mfa_code: code }
        : {};
      if (securityKey) {
        const options = await fluxerRequest<PublicKeyCredentialRequestOptionsJSON>(
          '/users/@me/sudo/webauthn/authentication-options',
          {},
          token,
        );
        if (!isAuthSessionCurrent(session) || getPasswordSetupProof() !== proof) return;
        if (!PublicKeyCredential.parseRequestOptionsFromJSON) {
          throw new Error('请更新浏览器后使用安全密钥');
        }
        const credential = (await navigator.credentials.get({
          publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
        })) as PublicKeyCredential | null;
        if (!credential) throw new Error('安全密钥验证已取消');
        if (!isAuthSessionCurrent(session) || getPasswordSetupProof() !== proof) return;
        Object.assign(verification, {
          mfa_method: 'webauthn',
          webauthn_response: credential.toJSON(),
          webauthn_challenge: options.challenge,
        });
      }
      if (!isAuthSessionCurrent(session) || getPasswordSetupProof() !== proof) return;
      const result = await fluxerRequest<{ token: string }>(
        '/users/@me/discord-password',
        { proof, new_password: password, ...verification },
        token,
      );
      if (!isAuthSessionCurrent(session)) return;
      acceptFluxerToken(result.token, session);
      setPassword('');
      setConfirmation('');
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['auth'] });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '设置失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="initial-password-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl bg-(--od-bg) p-6"
      >
        <h2 id="initial-password-title" className="text-lg font-semibold">
          设置 Fluxer 登录密码
        </h2>
        <p className="my-3 text-sm">
          设置后可以直接使用 Fluxer 用户名和密码登录，也可以继续通过 Discord 登录。
        </p>
        <FluxerLoginIdentity />
        <p className="mb-3 text-sm text-(--od-text-secondary)">
          以后也可以在「我的」页面查看登录用户名。
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            aria-label="新密码"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="新密码"
            className="w-full rounded border p-3"
          />
          <input
            aria-label="确认新密码"
            type="password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="再次输入密码"
            className="w-full rounded border p-3"
          />
          <input
            aria-label="已启用的二步验证码"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="若已开启二步验证，请输入验证码"
            className="w-full rounded border p-3"
          />
          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
          <button disabled={busy} className="rounded border p-3">
            {busy ? '正在设置…' : '设置密码'}
          </button>
          <button
            type="button"
            disabled={busy || !password || password !== confirmation}
            onClick={() => void submit(undefined, true)}
            className="ml-2 rounded border p-3"
          >
            使用安全密钥确认
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setOpen(false)}
            className="block text-sm"
          >
            以后再设置
          </button>
        </form>
      </section>
    </div>
  );
}
