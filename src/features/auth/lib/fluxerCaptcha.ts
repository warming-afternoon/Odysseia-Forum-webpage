import { solveChallengeWorkers } from 'altcha-lib';
import type { Challenge } from 'altcha-lib/types';

/** 在有界的 Web Worker 中完成 Fluxer 的原生验证码，不绕过服务端验证。 */
export async function solveFluxerCaptcha(challenge: Challenge): Promise<string> {
  if (!challenge || typeof challenge.signature !== 'string' || !challenge.parameters) {
    throw new Error('验证码响应无效');
  }
  const solution = await solveChallengeWorkers({
    challenge,
    concurrency: Math.min(4, navigator.hardwareConcurrency || 2),
    timeout: 60000,
    createWorker: () => new Worker(new URL('./fluxerCaptchaWorker.ts', import.meta.url), {
      type: 'module',
    }),
  });
  if (!solution) throw new Error('验证超时，请重新登录');
  return btoa(JSON.stringify({
    challenge: { parameters: challenge.parameters, signature: challenge.signature },
    solution,
  }));
}
