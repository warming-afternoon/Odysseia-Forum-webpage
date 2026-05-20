import { useMemo, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';

import {
  createFakeCaptchaChallenge,
  verifyFakeCaptcha,
} from '@/features/easter-eggs/lib/fakeCaptcha';
import { showMascotToast } from '@/features/mascot/lib/mascotToast';

interface FakeCaptchaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FakeCaptchaModal({ isOpen, onClose }: FakeCaptchaModalProps) {
  const [challengeSeed, setChallengeSeed] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const challenge = useMemo(() => createFakeCaptchaChallenge(), [challengeSeed]);

  const resetChallenge = () => {
    setSelectedIds(new Set());
    setChallengeSeed((value) => value + 1);
  };

  const toggleTile = (tileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tileId)) {
        next.delete(tileId);
      } else {
        next.add(tileId);
      }
      return next;
    });
  };

  const handleVerify = () => {
    if (verifyFakeCaptcha(challenge, selectedIds)) {
      showMascotToast({
        id: 'fake-captcha-success',
        emotion: 'success',
        eyebrow: 'Verification',
        title: '验证通过',
        message: '真人概率已提升至 99.7%。',
        duration: 3600,
      });
      onClose();
      return;
    }

    showMascotToast({
      id: 'fake-captcha-failed',
      emotion: 'confused',
      eyebrow: 'Verification',
      title: '验证失败',
      message: '图像识别模块请求重新尝试。',
      duration: 3600,
    });
    resetChallenge();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[26rem] overflow-hidden rounded-sm bg-white text-[#202124] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-[#4285F4] px-5 py-4 text-white">
          <div className="text-xs uppercase tracking-[0.18em] opacity-90">reCAPTCHA</div>
          <h2 className="mt-2 text-xl font-normal leading-snug">{challenge.prompt}</h2>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-3 gap-1 bg-[#DADCE0] p-1">
            {challenge.tiles.map((tile) => {
              const selected = selectedIds.has(tile.id);
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => toggleTile(tile.id)}
                  className="relative aspect-square overflow-hidden bg-white"
                  aria-pressed={selected}
                >
                  <img src={tile.imageSrc} alt="" className="h-full w-full object-contain p-2" />
                  {selected && (
                    <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#4285F4] text-white shadow-md">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[#DADCE0] pt-3">
            <button
              type="button"
              onClick={resetChallenge}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#4285F4] hover:bg-[#F1F3F4]"
              aria-label="换一组"
            >
              <RefreshCw className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 rounded-sm px-3 py-2 text-sm font-medium text-[#5F6368] hover:bg-[#F1F3F4]"
              >
                <X className="h-4 w-4" />
                取消
              </button>
              <button
                type="button"
                onClick={handleVerify}
                className="rounded-sm bg-[#4285F4] px-5 py-2 text-sm font-medium text-white hover:bg-[#3367D6]"
              >
                验证
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
