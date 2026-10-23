import type { CalendarRow } from '@oraqul/schema';

const week = (at: number) => (at === 0 ? 'Launch week' : `T${at < 0 ? '-' : '+'}${Math.abs(at)}`);

function when(row: CalendarRow): string {
  const span = row.until === undefined ? week(row.at) : `${week(row.at)} to ${week(row.until)}`;
  if (!row.from || !row.to) return span;
  return `${span} (${row.from === row.to ? row.from : `${row.from} to ${row.to}`})`;
}

/** What the source says about how many posts, and nothing it does not say. */
function posts(row: CalendarRow): string {
  if (row.count === null || row.per === null) {
    return row.grade === 'not-researched' ? 'Not researched' : 'No number given';
  }
  if (row.per === 'span') return String(row.count);
  return row.per === 'day' ? `${row.count} a day` : `At least ${row.count} a week`;
}

/**
 * The content calendar as a table, one per territory: when, what to post, the asset, the lead
 * channel and how many posts. Written by code from the release date; Oraqul makes none of it.
 */
export function CalendarTable({ rows }: { rows: CalendarRow[] }) {
  const territories = [...new Set(rows.map((r) => r.territory))];
  return (
    <div className="flex flex-col gap-6">
      {territories.map((territory) => {
        const own = rows.filter((r) => r.territory === territory);
        return (
          <div key={territory ?? 'all'} className="flex flex-col gap-2">
            {territory ? <h3 className="text-[15px] font-semibold">{territory}</h3> : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-[14px]">
                <caption className="sr-only">
                  Content calendar{territory ? ` for ${territory}` : ''}
                </caption>
                <thead>
                  <tr className="text-[12px] text-muted">
                    <th scope="col" className="py-1.5 pr-3 font-semibold">
                      When
                    </th>
                    <th scope="col" className="py-1.5 pr-3 font-semibold">
                      What to post
                    </th>
                    <th scope="col" className="py-1.5 pr-3 font-semibold">
                      Asset
                    </th>
                    <th scope="col" className="py-1.5 pr-3 font-semibold">
                      Lead channel
                    </th>
                    <th scope="col" className="py-1.5 font-semibold">
                      Posts
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {own.map((r) => (
                    <tr key={r.id} className="border-t border-line align-top">
                      <th scope="row" className="py-2 pr-3 font-semibold whitespace-nowrap">
                        {when(r)}
                      </th>
                      <td className="py-2 pr-3">{r.post}</td>
                      <td className="py-2 pr-3">{r.asset ?? 'As the step says'}</td>
                      <td className="py-2 pr-3">{r.channel}</td>
                      <td className="py-2">{posts(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
