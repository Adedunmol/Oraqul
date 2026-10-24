import { describe, expect, it } from 'vitest';
import { channelsFrom, platformsChosen } from './platforms.js';

describe('the platforms a brief picks', () => {
  it('reads the labelled “Channels we already use” line as the campaign’s platforms', () => {
    const text = 'Launch plan for the film "X".\nChannels we already use: WhatsApp and Instagram.';
    expect(channelsFrom(text)).toEqual(['Instagram', 'WhatsApp']);
    expect(platformsChosen(text)).toEqual(['Instagram', 'WhatsApp']);
  });

  it('prefers the labelled line over a platform named anywhere else in the brief', () => {
    const text = 'A film for TikTok fans.\nChannels we already use: Instagram.';
    expect(platformsChosen(text)).toEqual(['Instagram']);
  });

  it('does not take where a show is published for the campaign’s platforms', () => {
    const text =
      'Launch plan for the podcast "X".\nWhere it is published: Spotify, Apple, YouTube.\nA micro budget.';
    expect(platformsChosen(text)).toEqual([]);
  });

  it('still takes a platform named plainly in the brief, as before', () => {
    expect(platformsChosen('Platforms: Instagram, TikTok and YouTube.')).toEqual([
      'Instagram',
      'TikTok',
      'YouTube',
    ]);
    expect(platformsChosen('Nothing here.')).toEqual([]);
  });
});
