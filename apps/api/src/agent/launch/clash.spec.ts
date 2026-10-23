import { describe, expect, it } from 'vitest';
import { rivalsFrom } from './clash.js';

describe('rivalsFrom', () => {
  it('reads rivals and their days in the forms people write', () => {
    expect(
      rivalsFrom('Rivals: Harbor Lights on 2099-03-12; "Third Mainland" opens 2099-03-19'),
    ).toEqual([
      { title: 'Harbor Lights', date: '2099-03-12' },
      { title: 'Third Mainland', date: '2099-03-19' },
    ]);
    expect(rivalsFrom('Launch plan.\nRival: Avengers: Endgame (2099-05-01)')).toEqual([
      { title: 'Avengers: Endgame', date: '2099-05-01' },
    ]);
  });

  it('ignores a rival with no day, an impossible day, and text that is not a rival line', () => {
    expect(rivalsFrom('Rival: Harbor Lights')).toEqual([]);
    expect(rivalsFrom('Rival: Harbor Lights on 2099-13-45')).toEqual([]);
    expect(rivalsFrom('It opens on 2099-03-12 in Lagos.')).toEqual([]);
  });

  it('keeps each rival once', () => {
    expect(
      rivalsFrom('Rivals: Harbor Lights on 2099-03-12, Harbor Lights on 2099-03-12'),
    ).toHaveLength(1);
  });
});
