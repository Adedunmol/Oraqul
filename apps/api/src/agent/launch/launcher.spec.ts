import { describe, expect, it } from 'vitest';
import { launcherOf } from './launcher.js';

describe('launcherOf', () => {
  it('reads the Guide line first', () => {
    expect(launcherOf('A debut novel.\nWho is launching: Solo author')).toBe('solo');
    expect(launcherOf('Who is launching: A small team.\nWe are a self-published press')).toBe(
      'small',
    );
    expect(launcherOf('Who is launching: Established company')).toBe('established');
    expect(launcherOf('Who is launching: Major studio')).toBe('major');
  });

  it('reads plain words and takes the smallest reading', () => {
    expect(launcherOf('I am a self-published author with a debut in March')).toBe('solo');
    expect(launcherOf('A first-time author with a small press')).toBe('solo');
    expect(launcherOf('We are an independent studio shipping our first game')).toBe('small');
    expect(launcherOf('Released through an established label')).toBe('established');
    expect(launcherOf('A major studio tentpole')).toBe('major');
  });

  it('says nothing when the brief does not', () => {
    expect(launcherOf('A thriller set in Lagos, opening in October')).toBeNull();
  });

  it('does not read a solo album as a solo launcher', () => {
    expect(launcherOf('His debut solo album, a solo artist release on a big label')).toBeNull();
  });
});
