import type { Category } from '@oraqul/schema';
import { teamRule } from './shared';
import type { Rule } from './types';

// Oraqul writes the guides a team needs to make the creative: hooks, scripts, shot lists, key art
// briefs and caption packs. It never makes the ad, trailer, image or video (D8). These are the
// pieces a guide for each category is built from.

export interface CreativeRule {
  /** What the team makes from the guide, in words. */
  asset: string;
  /** Shots for a short video, in the order they appear. */
  shots: string[];
  /** What closes the script: the proof to show before the ask. */
  proof: string;
}

export const CREATIVE: Record<Category, Rule<CreativeRule>> = {
  film: teamRule('film.creative', {
    asset: 'trailer cut-down',
    shots: [
      'The strongest image of the film, held for two seconds.',
      'The lead reacting to the turn of the story.',
      'One line of dialogue as text on screen.',
      'A wide shot of the place, with the city named.',
      'The title card with the release date.',
    ],
    proof: 'a quote or a rating from an early screening',
  }),
  music: teamRule('music.creative', {
    asset: 'short video',
    shots: [
      'The artist singing the hook straight to camera.',
      'The lyric as text over a close-up.',
      'A listener reacting to the song for the first time.',
      'A street or room in the city, with the song under it.',
      'The artwork with the pre-save link.',
    ],
    proof: 'a save or share count once the song is out',
  }),
  books: teamRule('books.creative', {
    asset: 'book video',
    shots: [
      'The cover turned toward the camera.',
      'The first line read aloud over the page.',
      'The author in the setting of the book.',
      'A reader reacting to the opening.',
      'A bookshop shelf in the city, with the book on it.',
    ],
    proof: 'a line from an early review',
  }),
  podcasts: teamRule('podcasts.creative', {
    asset: 'audiogram or clip',
    shots: [
      'The strongest 20 seconds of the episode with captions.',
      'The host on camera making the one point that is new.',
      'The waveform and the cover art.',
      'A listener reacting to the clip.',
      'Where to listen, on screen for the last three seconds.',
    ],
    proof: 'a rating or a listener quote',
  }),
  games: teamRule('games.creative', {
    asset: 'gameplay clip',
    shots: [
      'Ten seconds of the core loop, with no menu.',
      'The reveal moment that no other game in the genre has.',
      'A creator reacting to the same moment.',
      'The store page with the wishlist button visible.',
      'The title card with the date.',
    ],
    proof: 'a demo clip or a wishlist count',
  }),
};

/** How a post is made for a channel, in a phrase. A channel with no entry gets the default. */
export const CHANNEL_STYLE: Record<string, string> = {
  tiktok: 'vertical, captions burned in, under 30 seconds',
  'instagram reels': 'vertical, captions burned in, under 30 seconds',
  'youtube shorts': 'vertical, a clear first frame, under 45 seconds',
  youtube: 'a thumbnail and a title that name the payoff, the hook inside the first five seconds',
  instagram: 'a carousel or a story set with a link sticker',
  whatsapp: 'a status image and a clip under a minute that is easy to forward',
  x: 'one post with the clip, a line people can quote and a thread for the story behind it',
  facebook: 'a native video and a post that gives a group something to answer',
  snapchat: 'vertical, sound on, under 20 seconds, with a swipe-up link',
  reddit: 'a plain post that answers a question the community asks, with the clip as proof',
  twitch: 'a live segment with a creator and a clip made of its best moment',
  discord: 'a pinned post with the clip and one question that does not spoil it',
};

export const channelStyle = (channel: string): string =>
  CHANNEL_STYLE[channel.toLowerCase()] ?? 'a clear first frame and one call to action';
