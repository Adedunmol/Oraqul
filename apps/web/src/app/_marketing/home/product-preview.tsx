import { h2Class, leadClass, wrap } from '../section';
import { AppPreview } from './app-preview';

/** The app itself, on its own band under the hero, so the hero keeps its air. */
export function ProductPreview() {
  return (
    <section
      aria-labelledby="preview-title"
      className="scheme-dark mk-glow relative overflow-x-clip bg-bg pt-[clamp(24px,4vw,64px)] pb-[clamp(72px,10vw,144px)]"
    >
      <div className={`${wrap} flex flex-col gap-[clamp(40px,6vw,80px)]`}>
        <div className="grid gap-6 min-[900px]:grid-cols-[1.2fr_1fr] min-[900px]:items-end">
          <h2 id="preview-title" className={h2Class}>
            A plan you can check, line by line.
          </h2>
          <p className={`${leadClass} min-[900px]:justify-self-end`}>
            Every claim about your audience comes with a receipt: the data it came from and the rule
            that turned it into a verdict.
          </p>
        </div>
        <AppPreview />
      </div>
    </section>
  );
}
