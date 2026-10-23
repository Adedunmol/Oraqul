import { wrap } from '../section';

// TODO(legal): these terms are written in plain words from what the product does. They need a legal
// review, and a contact address, before they are relied on.
const terms = [
  {
    title: 'What Oraqul is',
    body: 'Oraqul builds, checks and repairs launch plans for films, series, music, books, podcasts and games. It gives direction, not forecasts, and writes guides and scripts, not finished ads, trailers, images or video.',
  },
  {
    title: 'Your account and your team',
    body: 'You are responsible for what happens in your account and for the people you invite to your team. Owners can add and remove members. Keep your sign-in details to yourself.',
  },
  {
    title: 'What you put in',
    body: 'Put in only what you have the right to share. Oraqul sends only public entity names, place names and age bands to Qloo. Do not put personal data, customer lists or anything confidential that you cannot share with a language model provider in a brief or a file.',
  },
  {
    title: 'What you get out',
    body: 'A plan, a report or a creative kit is a draft for people to review. Every claim about taste, audience or place cites a finding; launch practice is labelled. You decide what to do with it, and a person makes the final creative and sends any message.',
  },
  {
    title: 'No guarantees',
    body: 'Qloo is a taste graph, not a record of sales. A direction such as okay, risky or avoid is a reading of that data, and a target is a goal you set, not a prediction. Coverage differs by place and title, and the product says when data is thin.',
  },
  {
    title: 'Acceptable use',
    body: 'Do not use Oraqul to break the law, to harm others, to probe or overload the service, or to put in material you do not have the right to use.',
  },
  {
    title: 'Changes',
    body: 'Oraqul changes as it is built. When these terms change, the date below changes with them.',
  },
];

export function TermsBody() {
  return (
    <div className={`${wrap} flex max-w-[68ch] flex-col gap-10 py-[clamp(56px,8vw,112px)]`}>
      <p className="text-[14px] text-muted">Last updated 23 October 2026.</p>
      {terms.map((t) => (
        <section key={t.title} className="flex flex-col gap-3">
          <h2 className="font-display text-[clamp(24px,2.6vw,32px)] leading-[1.1] font-semibold tracking-[-0.03em]">
            {t.title}
          </h2>
          <p className="text-[17px] leading-[1.65] text-ink/80">{t.body}</p>
        </section>
      ))}
    </div>
  );
}
