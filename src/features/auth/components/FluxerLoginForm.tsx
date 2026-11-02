import { useEffect, useRef, useState, type FormEvent } from 'react';
import { acceptFluxerToken, fluxerRequest, type FluxerLoginResult } from '../api/fluxerAuthApi';
import { captureAuthSession, isAuthSessionCurrent, type AuthSessionSnapshot } from '@/shared/lib/authSession';

interface LoginAttempt {
  session: AuthSessionSnapshot;
}

interface FluxerLoginFormProps {
  enabled: boolean;
  onSuccess: () => Promise<unknown> | void;
}

/** 直接使用 Fluxer 原生密码及 TOTP 登录，不经过 Forum 转发密码。 */
export function FluxerLoginForm({ enabled, onSuccess }: FluxerLoginFormProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<FluxerLoginResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ipTicket, setIpTicket] = useState<string | null>(null);
  const attemptRef = useRef<LoginAttempt | null>(null);
  useEffect(() => () => { attemptRef.current = null; }, []);

  const isCurrentAttempt = (attempt: LoginAttempt) =>
    attemptRef.current === attempt && isAuthSessionCurrent(attempt.session);

  const resetAttempt = () => {
    attemptRef.current = null;
    setChallenge(null);
    setIpTicket(null);
    setCode('');
  };

  const finish = async (result: FluxerLoginResult, attempt: LoginAttempt) => {
    if (!isCurrentAttempt(attempt)) return;
    if (result.token) {
      acceptFluxerToken(result.token, attempt.session);
      resetAttempt();
      setPassword('');
      await onSuccess();
    } else if (result.mfa && result.ticket) {
      setChallenge(result);
      setPassword('');
    } else {
      throw new Error('登录尚未完成，请在 Fluxer 完成账号验证后重试');
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!enabled || busy) return;
    const attempt = challenge ? attemptRef.current : { session: captureAuthSession() };
    if (!attempt || (challenge && !isCurrentAttempt(attempt))) {
      resetAttempt();
      setError('登录状态已变化，请重新登录');
      return;
    }
    attemptRef.current = attempt;
    setBusy(true);
    setError('');
    try {
      await finish(await fluxerRequest<FluxerLoginResult>(
        challenge ? '/auth/login/mfa/totp' : '/auth/login',
        challenge ? { ticket: challenge.ticket, code } : { login, password },
      ), attempt);
    } catch (reason) {
      if (!isCurrentAttempt(attempt)) return;
      const data = (reason as {
        data?: { ip_authorization_required?: boolean; ticket?: string };
      })?.data;
      if (data?.ip_authorization_required && data.ticket) {
        setIpTicket(data.ticket);
        setPassword('');
        setError('请打开 Fluxer 发送的验证邮件，确认本次登录后点击下方按钮。');
      } else {
        setError(reason instanceof Error ? reason.message : '登录失败');
      }
    } finally {
      setBusy(false);
    }
  };

  const pollIp = async () => {
    if (!ipTicket || busy) return;
    const attempt = attemptRef.current;
    if (!attempt || !isCurrentAttempt(attempt)) {
      resetAttempt();
      setError('登录状态已变化，请重新登录');
      return;
    }
    setBusy(true);
    try {
      const result = await fluxerRequest<FluxerLoginResult & { completed: boolean }>(
        `/auth/ip-authorization/poll?ticket=${encodeURIComponent(ipTicket)}`,
      );
      if (!isCurrentAttempt(attempt)) return;
      if (result.completed) {
        await finish(result, attempt);
        setIpTicket(null);
      } else {
        setError('尚未收到邮件确认，请完成验证后重试。');
      }
    } catch (reason) {
      if (!isCurrentAttempt(attempt)) return;
      setError(reason instanceof Error ? reason.message : '验证失败');
    } finally {
      setBusy(false);
    }
  };

  const passkey = async () => {
    if (!challenge?.ticket || busy) return;
    const attempt = attemptRef.current;
    if (!attempt || !isCurrentAttempt(attempt)) {
      resetAttempt();
      setError('登录状态已变化，请重新登录');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const options = await fluxerRequest<PublicKeyCredentialRequestOptionsJSON>(
        '/auth/login/mfa/webauthn/authentication-options',
        { ticket: challenge.ticket },
      );
      if (!isCurrentAttempt(attempt)) return;
      if (!PublicKeyCredential.parseRequestOptionsFromJSON) {
        throw new Error('当前浏览器不支持此安全密钥流程，请使用验证器或更新浏览器');
      }
      const credential = await navigator.credentials.get({
        publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
      }) as PublicKeyCredential | null;
      if (!isCurrentAttempt(attempt)) return;
      if (!credential) throw new Error('安全密钥验证已取消');
      await finish(await fluxerRequest<FluxerLoginResult>('/auth/login/mfa/webauthn', {
        ticket: challenge.ticket,
        challenge: options.challenge,
        response: credential.toJSON(),
      }), attempt);
    } catch (reason) {
      if (!isCurrentAttempt(attempt)) return;
      setError(reason instanceof Error ? reason.message : '验证失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 text-left">
      <p className="text-center text-sm text-(--od-text-secondary)">或使用 Fluxer 账号登录</p>
      {!challenge ? (
        <>
          <input
            aria-label="Fluxer 用户名或邮箱"
            autoComplete="username"
            required
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            placeholder="用户名或邮箱"
            className="w-full rounded-lg border border-(--od-border) p-3"
          />
          <input
            aria-label="Fluxer 密码"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="密码"
            className="w-full rounded-lg border border-(--od-border) p-3"
          />
        </>
      ) : (
        <input
          aria-label="二步验证码"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="验证器验证码或备用码"
          className="w-full rounded-lg border border-(--od-border) p-3"
        />
      )}
      {ipTicket && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void pollIp()}
          className="w-full rounded-lg border p-3"
        >
          已完成邮件验证，继续登录
        </button>
      )}
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      {(!challenge || challenge.totp || challenge.backup_codes) && (
        <button
          disabled={!enabled || busy}
          className="w-full rounded-lg border border-(--od-border) p-3 disabled:opacity-50"
        >
          {busy ? '正在验证…' : challenge ? '验证并登录' : '登录 Fluxer 账号'}
        </button>
      )}
      {challenge?.webauthn && (
        <button
          type="button"
          disabled={!enabled || busy}
          onClick={() => void passkey()}
          className="w-full rounded-lg border p-3"
        >
          使用安全密钥
        </button>
      )}
      {challenge && (
        <button
          type="button"
          onClick={() => {
            resetAttempt();
          }}
          className="text-sm"
        >
          返回账号登录
        </button>
      )}
    </form>
  );
}
