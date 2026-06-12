import { describe, expect, it } from 'vitest';

import {
  buildDiscordAppThreadUrl,
  buildDiscordThreadUrl,
  buildDiscordWebThreadUrl,
} from './discord';

describe('discord link builders', () => {
  const options = {
    guildId: '1134557553011998840',
    channelId: '1307242450300964986',
    threadId: '1442755349311651901',
  };

  it('生成 Discord 网页端帖子链接', () => {
    expect(buildDiscordWebThreadUrl(options)).toBe(
      'https://discord.com/channels/1134557553011998840/1307242450300964986/1442755349311651901',
    );
  });

  it('生成 Discord App Deep Link', () => {
    expect(buildDiscordAppThreadUrl(options)).toBe(
      'discord://-/channels/1134557553011998840/1307242450300964986/1442755349311651901',
    );
  });

  it('根据打开方式选择链接格式', () => {
    expect(buildDiscordThreadUrl(options, 'web')).toBe(buildDiscordWebThreadUrl(options));
    expect(buildDiscordThreadUrl(options, 'app')).toBe(buildDiscordAppThreadUrl(options));
  });
});
