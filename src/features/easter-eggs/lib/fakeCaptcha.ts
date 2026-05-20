import { MASCOT_IMAGES } from '@/features/mascot/assets';

export interface FakeCaptchaTile {
  id: string;
  mascotKey: string;
  imageSrc: string;
  isTarget: boolean;
}

export interface FakeCaptchaChallenge {
  prompt: string;
  tiles: FakeCaptchaTile[];
}

const challenges = [
  { prompt: '请选择所有包含「Durvis」的图片', target: 'durvis' },
  { prompt: '请选择所有包含「喝茶类脑娘」的图片', target: 'tea' },
  { prompt: '请选择所有包含「困惑表情」的图片', target: 'confused' },
  { prompt: '请选择所有包含「小号」的图片', target: 'blow_the_trumpet' },
] as const;

const distractorKeys = [
  'hi',
  'hi2',
  'success',
  'error',
  'surprise',
  'sleep',
  'letsgo',
  'write',
  'invite',
  'pride',
];

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function createFakeCaptchaChallenge(): FakeCaptchaChallenge {
  const challenge = challenges[Math.floor(Math.random() * challenges.length)];
  const targetCount = 2 + Math.floor(Math.random() * 2);
  const availableDistractors = distractorKeys.filter((key) => key !== challenge.target && MASCOT_IMAGES[key]);

  const targetTiles = Array.from({ length: targetCount }, (_, index) => ({
    id: `target-${challenge.target}-${index}`,
    mascotKey: challenge.target,
    imageSrc: MASCOT_IMAGES[challenge.target],
    isTarget: true,
  }));

  const distractorTiles = shuffle(availableDistractors)
    .slice(0, 9 - targetCount)
    .map((key, index) => ({
      id: `distractor-${key}-${index}`,
      mascotKey: key,
      imageSrc: MASCOT_IMAGES[key],
      isTarget: false,
    }));

  return {
    prompt: challenge.prompt,
    tiles: shuffle([...targetTiles, ...distractorTiles]),
  };
}

export function verifyFakeCaptcha(challenge: FakeCaptchaChallenge, selectedIds: Set<string>) {
  return challenge.tiles.every((tile) => selectedIds.has(tile.id) === tile.isTarget);
}
