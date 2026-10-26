/** Content width and side padding for every marketing section. design-system §6 */
export const wrap = 'mx-auto w-full max-w-[1240px] px-[clamp(16px,2.4vw,32px)]';

/** Vertical rhythm of a full section. */
export const band = 'py-[clamp(72px,10vw,144px)]';

export const h1Class =
  'font-display text-[clamp(40px,6vw,80px)] font-medium leading-[1.02] tracking-[-0.04em] [font-stretch:108%] text-balance';

export const h2Class =
  'font-display text-[clamp(32px,4.6vw,60px)] font-medium leading-[1.04] tracking-[-0.035em] [font-stretch:106%] text-balance';

export const leadClass = 'max-w-[52ch] text-[clamp(16px,1.4vw,19px)] leading-[1.55] text-muted';

/**
 * Home page bands: padding from the viewport's height and, on a screen wide enough, the height of one
 * screen with the content centred, so a section is read whole. A phone flows naturally instead,
 * because stacked content cannot fit one screen there.
 */
export const fitBand =
  'py-[clamp(28px,5.5svh,72px)] min-[1000px]:flex min-[1000px]:min-h-[calc(100svh-64px)] min-[1000px]:flex-col min-[1000px]:justify-center';

/** A headline that also gives way to a short screen, so it never pushes a section past one screen. */
export const fitH2 = `${h2Class} min-[1000px]:text-[clamp(30px,min(4.6vw,6.4svh),60px)]!`;
