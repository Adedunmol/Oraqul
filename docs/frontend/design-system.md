# Oraqul: Design System

Read with the PRD and the spec. The hosted prototype is the visual reference. Where this file and the prototype disagree, fix the one that is wrong.

## 1. Direction in one paragraph

Calm, clear and a little cinematic. Oraqul is a tool for people who have to judge numbers and defend a plan, so the screen must never be louder than the content. Neutral surfaces, one dark ink for primary actions, a quiet blue for focus and selection, and colour used for exactly two jobs: verdicts and categories. A serif appears on page titles and the bottom line, so the product feels like a briefing and not a dashboard. Everything else is a clean sans.

Avoid on purpose: gradients, film strips, ticket shapes, poster cards, coloured side stripes, dots as status markers, and any effect that competes with the content.

## 2. Principles

1. **Quiet by default.** Colour, motion and weight are spent only where they carry meaning.
2. **Decision first.** Every output opens with the bottom line and the next step. Detail sits one click down.
3. **Show the evidence, plainly.** Verdicts are an icon plus a word plus a colour. Confidence is a word with a three bar meter. Never a percentage. Every claim has a receipt.
4. **Say what things mean.** Each tab opens with one sentence on what it shows. Each start option says what you get and what you bring.
5. **Few choices at a time.** Four main tabs, rest under More. One question card at a time. Three ways to start.
6. **Keyboard friendly, never keyboard only.** Search on ⌘K or Ctrl K. Number keys pick options. Everything also works with a pointer and on a phone.
7. **Motion explains.** Things move to show that something arrived, opened or finished. Nothing moves for decoration.

## 3. Colour

All colour is a token. Define every token on bare `:root` (light), then redefine in the two dark blocks. Never hard code a colour in a component.

### 3.1 Neutrals and accent

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #F4F4F1 | #0D0E10 | App background, sidebar |
| `--surface` | #FFFFFF | #151618 | Main panel, cards, inputs |
| `--surface2` | #F0F0EC | #1D1F22 | Chips, tab track, quiet fills, user bubble |
| `--ink` | #16171A | #ECECEA | Text, primary button fill |
| `--muted` | #686A72 | #9A9CA4 | Secondary text, labels |
| `--line` | #E5E5E0 | #2A2C31 | Borders, dividers |
| `--accent` | #3F51C9 | #93A3F6 | Focus ring, selected state, links, progress |
| `--accent-ink` | #FFFFFF | #0D0E10 | Text on accent |
| `--accent-soft` | #ECEEFB | #1F2338 | Soft accent fill |

Why a blue accent and not teal: teal sits next to the green used for "holds" and reads as the same family. Blue keeps verdict colours distinct.

### 3.2 Verdicts

Used only on verdicts and verdict counts, never as decoration.

| Verdict | Text light | Fill light | Text dark | Fill dark | Icon |
|---|---|---|---|---|---|
| Holds | #1B7F4B | #E4F3EA | #5FCB92 | #10281C | tick |
| Weak | #8F5C00 | #FBEFD3 | #E8B54F | #2B2210 | half circle |
| Breaks | #BA2B24 | #FBE6E4 | #F0807A | #321A19 | cross |
| Could not test | #686A72 | #ECECE8 | #9A9CA4 | #222427 | dotted circle |

Tokens: `--holds --holds-bg --weak --weak-bg --breaks --breaks-bg --cant --cant-bg`. Also `--good --warn --crit --na` for chart and status use, and `--s1 --s2` for chart series.

### 3.3 Categories

Used only as a small tinted icon tile (15 percent mix on the surface) and the icon stroke. Never as a fill for a large area, never as text.

| Category | Colour |
|---|---|
| Film and series | #6C7FD8 |
| Music | #C86BA3 |
| Books | #3E9F94 |
| Podcasts | #8F76D9 |
| Games | #D19A3F |

Set with `[data-cat="film"]{--cat:#6C7FD8}` and so on. Put `data-cat` on the nav button, the project card and the body.

## 4. Type

| Role | Family | Weight | Size | Notes |
|---|---|---|---|---|
| Page title | Fraunces | 500 | clamp(26px, 3vw, 34px) | line height 1.1, tracking −0.015em |
| Bottom line | Fraunces | 500 | clamp(23px, 2.3vw, 28px) | max width 30ch |
| Section and card titles | Geist | 600 | 15 to 18px | tracking −0.02em |
| Body | Geist | 400 | 14.5px | line height 1.5 |
| Agent message | Geist | 400 | 15.5px | line height 1.6, no bubble |
| Label (tag) | Geist | 600 | 11px | uppercase, tracking 0.08em, muted |
| Numbers in tables and tiles | Geist | 600 | 28px for tiles | tabular numerals everywhere digits line up |
| Call ids, endpoints, keycaps | Geist Mono | 400 to 500 | 11 to 12px | |

Fonts load from Google Fonts: Fraunces (opsz 9..144, 500 and 600), Geist (400, 500, 600), Geist Mono (400, 500). Fallbacks: serif `"Iowan Old Style", Georgia, serif`; sans `system-ui, -apple-system, "Segoe UI", sans-serif`; mono `ui-monospace, Menlo, Consolas, monospace`.

Headings use text wrap balance. Running text stays under 70 characters wide.

## 5. Shape, space and depth

* **Radius.** Buttons and inputs 10. Chips, pills, receipt chips 7 to 8. Small cards and lines 12. Cards, tiles, question cards 16. Main panel 20. Drawer and modals 18. Keycaps 5.
* **Space.** A 4px base. Common steps: 4, 8, 12, 16, 20, 24, 32. Page padding clamp(20px, 3vw, 40px). Gap between cards 12.
* **Borders.** 1px `--line` everywhere. Cards get a border and no shadow.
* **Shadow.** Only for things that float: drawer, modal, palette, toast, hover lift on cards. Light `0 16px 40px rgba(20,20,30,.14)`, dark `0 16px 40px rgba(0,0,0,.6)`. Small hover lift `0 8px 24px rgba(20,20,30,.07)`.
* **No side stripes.** Never mark a card with a coloured left border. Never use dots as status markers. Use an icon, a word or a fill.

## 6. Layout

* **Shell.** Two columns on desktop: a 232px sidebar on `--bg`, and a main panel on `--surface` with a 20px radius and a 1px line ring, inset 8px from the right and bottom.
* **Sidebar.** Brand, team switcher, search button (shows ⌘K), nav, then the user block. Nav groups: All projects, Categories (five, each with its tinted icon and a count), Manage (Team). Labels always visible.
* **Page head.** Small label (team or kind), serif title, primary action on the right.
* **Project grid.** Cards in a grid of at least 270px columns.
* **Output page.** Header with crumbs, label, serif title and actions. Segmented tabs. Tab note. Content.
* **Chat page.** A 760px column, agent text left without a bubble, user text right in a soft bubble. Input pinned at the bottom with quick action chips above it.
* **Breakpoint.** 900px. Below it the sidebar is replaced by a top bar with the brand and a category select, grids become one column, the dock chat and what if bar are hidden, and charts keep their table view.

## 7. Components

### 7.1 Logo
A rounded box with an "o" ring inside. Box 28px, radius 8, fill `--ink`. Ring 12px, 2.6px stroke in `--bg`. Wordmark "Oraqul" beside it in the serif at 17px, weight 600.

### 7.2 Buttons
Default: surface fill, 1px line, radius 10, padding 7 by 14, weight 500, faint shadow. Primary: `--ink` fill, `--bg` text, no shadow, hover to 88 percent opacity. Small: padding 4 by 11, 13px. Ghost: transparent, no shadow. Pressed: scale 0.98. Disabled: 45 percent opacity.

### 7.3 Inputs
Radius 10, padding 9 by 12, surface fill, 1px line. Focus: 2px outline of accent at 45 percent, border becomes `--accent`.

### 7.4 Chips
Radius 8, `--surface2` fill, no border, 12.5px. Filter chips use the same shape and switch to an accent border when selected.

### 7.5 Verdict pill
Radius 7, 12px, weight 600, padding 2 by 9. Fill and text from the verdict tokens. Starts with a glyph: tick, half circle, cross, dotted circle. The word is always present: Holds, Weak, Breaks, Could not test.

### 7.6 Confidence
Shown as a word (High, Medium, Low, Lower) plus a three bar meter in neutral ink. Border `--line`, radius 7. Never coloured as a verdict and never a percentage.

### 7.7 Receipt chip
Small chip, radius 7, 12px, `--surface` fill, line border, muted text. Label "View receipt". It opens the receipt drawer. Every line that makes a claim carries one.

### 7.8 Cards and lines
Card: surface, 1px line, radius 16. Line item (`.ln`): radius 12, padding 12 by 16, title, one line of detail, verdict pill and confidence on the right. A changed line gets an 8 percent accent fill and an accent tinted border, plus the word "Updated" and what it was before.

### 7.9 Tabs
A segmented control: `--surface2` track, radius 12, padding 4. Each tab radius 9, padding 6 by 13. Selected tab is `--surface` with a line ring and a faint shadow. Show four tabs by default (Summary, Plan, Assumptions, Evidence) plus the current tab. The rest sit under a "More (n)" tab that toggles to "Fewer".

### 7.10 Tab note
A single muted sentence above the content, 13.5px, max 68 characters wide. Every tab has one. Keep the wording in section 10.

### 7.11 Start here cards
Three equal cards: Plan a launch, Check a plan I have, Rescue one that missed. Each has a numbered square (ink fill), a title, two lines on what you get, and "You bring: ..." in medium weight. Clicking starts the chat with the right first question. Hover lifts 2px.

### 7.12 Project card
A 40px tinted icon tile on the left (category colour at 15 percent, icon stroke in the category colour), then title, kind and window, updated date, and a status chip. Hover lifts 2px with a soft shadow.

### 7.13 Summary card
Two columns on desktop. Left: label "Bottom line", the serif headline, confidence, one sentence of why, then Copy summary, Export brief, See the evidence. Right: label "Do this" and up to three rows, each a numbered keycap, one instruction, and a receipt chip. Rows use `--surface2` fill and radius 12. One column on mobile.

### 7.14 Question card
Radius 16, padding 16. The prompt in 15.5px weight 600. Options are rows (radius 12, surface fill, line border) with a keycap number on the left, label, and a muted description on the right. Hover fills `--surface2`. Selected gets the accent border and an 8 percent accent fill. Once answered the card turns into a dashed, quiet summary line.

### 7.15 Agent trace
A card (radius 14). While running: a 2px progress bar across the top, a small "Working" label with "Step n of m", and one row per step. The running row has a spinner and a shimmering label. Finished rows have a green tick. When done it collapses to "Agent trace, n steps" with a chevron. Steps are plain sentences.

### 7.16 Charts
Inline SVG or CSS. Every chart has a legend, a hover tooltip and a "View as table" toggle. Verdict colours carry a glyph in the legend. Bars grow from their baseline on first view. Series colours come from `--s1` and `--s2` and the verdict tokens, never from category colours.

### 7.17 Receipt drawer
A sheet from the right, inset 10px, radius 18, 420px wide, with a line border and the floating shadow. Contents: label "Receipt", the claim, a verdict pill, then Call id, Endpoint, Input, Returned, How it was decided, Confidence, and the example response shape in a mono code box. A note on what leaves the team and a Close button.

### 7.18 Search palette (⌘K)
A centred 600px panel, radius 18, on a blurred scrim. Search field with an esc keycap. Results grouped as Go to, Categories, Projects, Outputs, Actions, each with its icon. Arrow keys move, Enter opens. A footer shows the keys.

### 7.19 Modal, toast
Modal radius 18, on a blurred scrim. Toast: ink fill, radius 12, bottom centre.

### 7.20 Icons
Stroke icons on a 24 grid, 1.7px stroke, round caps and joins, `currentColor`. Set: all projects, film, music, books, podcasts, games, team, search. Draw new ones in the same style.

## 8. Motion

Easing for everything that arrives: `cubic-bezier(.2, .8, .2, 1)`. Colour changes use 160ms.

| What | Motion | Time |
|---|---|---|
| View change | Children rise 10px and fade in, staggered 40ms | 420ms |
| Tab change | Content rises and fades | 340ms |
| Agent message | Words fade in from a 5px blur, 26ms apart, capped at 1.6s | 450ms each |
| New card or output | Rises 8px and scales from 0.97 | 380ms |
| Trace | Progress bar width eases per step. Running label shimmers. Spinner turns | 500ms, 1.5s, 0.7s |
| Bars and columns | Grow from their baseline on first view of a tab | 700ms |
| Drawer | Slides in 24px from the right and fades | 300ms |
| Modal, palette, menu | Pop from 0.97 and fade, scrim fades with blur | 160 to 260ms |
| Hover on cards | Lift 2px, border darkens | 160ms |
| Press | Scale 0.98 | 160ms |

Rules: animate only things that are new, never replay on a re render. Track what has been shown (the prototype keeps a seen count per thread). Respect `prefers-reduced-motion` by cutting every duration to near zero.

## 9. Accessibility and quality bar

* Colour never carries meaning alone. Verdicts use glyph plus word.
* Body text meets 4.5 to 1 contrast on its surface in both themes. This was not formally measured in the prototype; measure before shipping.
* Focus is always visible. Tabs, options and chips are real buttons. Dialogs and the drawer have labels.
* Tap targets are at least 40px on mobile.
* Light and dark both designed. Respect the system setting and allow an override.
* Test on a mid range Android phone and on slow networks. Fonts load with `display=swap`, so text shows in the fallback first.

## 10. Words

Use plain words. Short sentences. No jargon without a one line explanation next to it.

| Use | Avoid |
|---|---|
| Plan a launch, Check a plan I have, Rescue one that missed | Generate, Analyse, Run audit |
| Holds, Weak, Breaks, Could not test | Validated, Invalidated, Inconclusive |
| Receipt (the exact Qloo call behind a claim) | Provenance, Citation, Trace id |
| Bottom line, Do this | Executive summary, Recommendations |
| Could not test | N/A, Unavailable |
| Low confidence | 42 percent |

Tab notes (keep these in the product):

* Summary: The short version: what to do first, and how sure Oraqul is.
* Audience: Who the launch is for, measured against Qloo taste data.
* Assumptions: Every belief your plan rests on. Holds means Qloo data supports it. Breaks means it does not. Each one has a receipt: the exact Qloo call behind it.
* Plan: The plan itself, section by section.
* Risks: What could go wrong, and what to do about it.
* Could not test: What Oraqul could not test, and why. You may need to supply this.
* Evidence: Every claim with its receipt. Use this to check any number.
* What changed: What moved compared with the plan before.
* Results: The results you added, compared with what the plan expected.
* Date check: How each date overlaps with rival releases. Lower overlap is better.
* Partner briefs: Drafts for partners. Nothing is sent from here.

Never write: forecasts, sales promises, or anything that suggests the agent sent something.

## 11. Implementation

### 11.1 Token block
Copy this shape exactly. Light on bare `:root`. Dark redefined in the media query (guarded) and again under `[data-theme="dark"]`. Add `color-scheme: dark` in both dark blocks. Give `body` its background from a token.

```css
:root{
  --bg:#F4F4F1;--surface:#FFFFFF;--surface2:#F0F0EC;--ink:#16171A;--muted:#686A72;--line:#E5E5E0;
  --accent:#3F51C9;--accent-ink:#FFFFFF;--accent-soft:#ECEEFB;
  --holds:#1B7F4B;--holds-bg:#E4F3EA;--weak:#8F5C00;--weak-bg:#FBEFD3;
  --breaks:#BA2B24;--breaks-bg:#FBE6E4;--cant:#686A72;--cant-bg:#ECECE8;
  --shadow:0 16px 40px rgba(20,20,30,.14);--s1:#3F51C9;--s2:#A6A8B0;
  --good:#1B7F4B;--warn:#B9770E;--crit:#BA2B24;--na:#B7B8BE;--grid:#E5E5E0;
  --f-display:"Fraunces","Iowan Old Style",Georgia,serif;
  --f-body:"Geist",system-ui,-apple-system,"Segoe UI",sans-serif;
  --f-mono:"Geist Mono",ui-monospace,Menlo,Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#0D0E10;--surface:#151618;--surface2:#1D1F22;--ink:#ECECEA;--muted:#9A9CA4;--line:#2A2C31;
  --accent:#93A3F6;--accent-ink:#0D0E10;--accent-soft:#1F2338;
  --holds:#5FCB92;--holds-bg:#10281C;--weak:#E8B54F;--weak-bg:#2B2210;
  --breaks:#F0807A;--breaks-bg:#321A19;--cant:#9A9CA4;--cant-bg:#222427;
  --shadow:0 16px 40px rgba(0,0,0,.6);--s1:#93A3F6;--s2:#5A5C64;
  --good:#5FCB92;--warn:#E8B54F;--crit:#F0807A;--na:#4C4E55;--grid:#2A2C31;color-scheme:dark}}
:root[data-theme="dark"]{ /* same dark values as above */ color-scheme:dark }
body{background:var(--bg);color:var(--ink)}
```

### 11.2 Next.js notes
* Put tokens in `globals.css`. Load fonts with `next/font/google` (Fraunces, Geist, Geist Mono) and map them to `--f-display`, `--f-body`, `--f-mono`.
* Build the components in section 7 as one small set: Button, Input, Chip, VerdictPill, Confidence, ReceiptChip, Card, Line, Tabs, TabNote, StartCard, ProjectCard, SummaryCard, QuestionCard, Trace, Chart, ReceiptDrawer, Palette, Modal, Toast, Icon.
* Verdict and confidence components take the data value and render the glyph and word themselves, so no screen can show colour alone.
* The prototype's CSS is the working reference: `src/css/04_theme_calm.css` holds the tokens and theme, on top of `01_base.css`, `02_categories.css` and `03_motion_and_shared.css`.
* Behaviour reference: `src/js/07_fx.js` for the palette and view animations, and `src/js/03_core.js` for the word by word reveal and the seen tracking of new messages.

### 11.3 What to test with real people
Show five or six launch marketers, including Nigerian users on mid range Android. Watch for: can they find a category without help, do they pick the right start card, do they understand Holds and Breaks without the note, and do they open a receipt unprompted. Fix wording before fixing visuals.
