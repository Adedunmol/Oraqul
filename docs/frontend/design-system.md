# Oraqul: Design System

Read with the PRD and the spec. The hosted prototype is the visual reference. Where this file and the prototype disagree, fix the one that is wrong.

## 1. Direction in one paragraph

Calm, clear and a little cinematic. Oraqul is a tool for people who have to judge numbers and defend a plan, so the screen must never be louder than the content. Neutral surfaces, one near black ink for text, a confident cobalt for primary actions, focus and selection, and colour used for exactly two jobs: verdicts and categories. Titles and the bottom line use Space Grotesk, a wide geometric grotesque with a distinctive y and g that stays easy to read at headline size, so the product feels like a briefing and not a dashboard. Everything else is Geist. It should feel like a well funded enterprise product: solid cards that stand out from a neutral canvas by their fill and a small lift, never an outline, solid buttons, small corners, and a few icons only where they carry meaning.

Avoid on purpose: gradients, film strips, ticket shapes, poster cards, coloured side stripes, dots as status markers, heavy shadows, large round corners, and any effect that competes with the content. The public marketing pages are the one exception: they may use art, colour fields and decorative motion to sell the product (§6, Marketing pages), never inside the app.

## 2. Principles

1. **Quiet by default.** Colour, motion and weight are spent only where they carry meaning.
2. **Decision first.** Every output opens with the bottom line and the next step. Detail sits one click down.
3. **Show the evidence, plainly.** Verdicts are an icon plus a word plus a colour. Confidence is a word with a three bar meter. Never a percentage. Every claim has a receipt.
4. **Say what things mean.** Each tab opens with one sentence on what it shows. Each start option says what you get and what you bring.
5. **Few choices at a time.** One message box to start. The agent guesses and says so instead of asking, and asks one question card at a time only when a guess would waste the run. Four main tabs, rest under More.
8. **Say it, do not navigate it.** Every capability is something you can ask for in the chat. A new feature is a next step the agent can suggest, not a new page or tab.
6. **Keyboard friendly, never keyboard only.** Search on ⌘K or Ctrl K. Number keys pick options. Everything also works with a pointer and on a phone.
7. **Motion explains.** Things move to show that something arrived, opened or finished. Nothing moves for decoration.

## 3. Colour

All colour is a token. Define every token on bare `:root` (light), then redefine in the two dark blocks. Never hard code a colour in a component.

### 3.1 Neutrals and accent

Neutral greys with no blue tint, so the screen never looks like a generic dark AI app: a light grey canvas with white cards in light, a near black canvas with charcoal cards in dark, and one cobalt for action. Cards stand out from the canvas by fill (about 1.12:1) and a small lift, with no outline. Every text pair passes WCAG AA (4.5:1).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #FFFFFF | #09090A | App background, sidebar |
| `--canvas` | #F2F2F4 | #0E0E10 | The main panel that cards sit on |
| `--surface` | #FFFFFF | #141417 | Fields, the palette and the drawer |
| `--inset` | #EFEFF2 | #141417 | A panel inside a card: the user's message, the agent trace, an open question card, plan lineage rows. Never `--surface` for this: in light `--surface` and `--card` are both white, so the panel vanishes (5.5:1 muted text light, 6.6:1 dark) |
| `--surface2` | #ECECEF | #26262B | Tab track, quiet labels, hover fill for default buttons and chips |
| `--surface2-hover` | #E3E3E7 | #2E2E34 | Hover fill on `--surface2` |
| `--button` | #E4E4E9 | #26262B | Default buttons, chips, the receipt chip and the output line in the chat: a solid fill with no outline that stands out on both the canvas and a card (text 14.9:1 light, 13.5:1 dark) |
| `--button-hover` | #DADAE0 | #303036 | Hover on `--button` |
| `--card` | #FFFFFF | #1B1B1F | Cards, rows, lines and empty states, always with `--elev-1` (set once on `.bg-card` in `globals.css`) and never an outline |
| `--card-hover` | #F6F6F8 | #232328 | Hover: only the fill changes. A step darker in light; in dark a step lighter, because a darker card would sink into the canvas |
| `--ink` | #111114 | #F2F2F4 | Text, tooltips, toasts |
| `--muted` | #5A5A63 | #9A9AA3 | Secondary text, labels, idle icons |
| `--line` | #E6E6EA | #27272C | Field and button edges, dividers, table rows, chart axes |
| `--primary` | #1E47C2 | #2B54D4 | Primary button fill, the New project button, the sidebar avatar and logo |
| `--primary-hover` | #1A3DA8 | #3460E0 | Hover on primary |
| `--primary-ink` | #FFFFFF | #FFFFFF | Text on primary (7.7:1 light, 6.3:1 dark): a deep royal blue, so primary actions feel weighty rather than bright |
| `--accent` | #1E47C2 | #8AA9FF | Focus ring, selected state, links, progress, accent icons |
| `--accent-ink` | #FFFFFF | #06101F | Text on accent |
| `--accent-soft` | #EAF0FF | #1C2440 | Selected and changed states, the active nav item, with an accent edge at 40 percent |

`--primary` and `--accent` match in light. In dark they split: a fill white text can sit on, and a lighter blue that reads as text on charcoal.

Why cobalt and not teal: teal sits next to the green used for "holds" and reads as the same family. Cobalt keeps verdict colours distinct, and as the one saturated hue on a neutral screen it always means "act here" or "selected".

### 3.2 Verdicts

Used only on verdicts and verdict counts, never as decoration.

| Verdict | Text light | Fill light | Text dark | Fill dark | Icon |
|---|---|---|---|---|---|
| Holds | #167A40 | #E8F5EC | #5CC98B | #10251A | tick |
| Weak | #8A5800 | #FBF2D9 | #E3AE4A | #2A2010 | half circle |
| Breaks | #BE3128 | #FCEBE9 | #F27A6F | #2F1715 | cross |
| Could not test | #5A5A63 | #ECECEF | #9A9AA3 | #26262B | dotted circle |

Tokens: `--holds --holds-bg --weak --weak-bg --breaks --breaks-bg --cant --cant-bg`. Also `--good --warn --crit --na` for chart and status use, and `--s1 --s2` for chart series.

### 3.3 Categories

Used for small tinted icon tiles (15 percent mix on the surface) and icon strokes, and as the tint of a project card: the category colour mixed into `--card` at `--cat-tint` (20 percent light, 24 dark), deepening to `--cat-tint-hover` (28 light, 30 dark) on hover, through `.cat-card`, so the colour is plain at a glance in both themes. Inside a tinted card `--muted` becomes ink mixed at 72 percent into the card, which keeps secondary text at 4.5:1 or more on every category, hover included. Never on other large areas, never as text. A tinted card also names its category in words wherever the list mixes categories, so colour never carries it alone.

| Category | Light | Dark | Why |
|---|---|---|---|
| Film and series | #D12F45 crimson | #F25C6E | Cinema reads red: curtains, the red carpet, Netflix and YouTube. Blue felt corporate and sat too close to the cobalt action colour |
| Music | #C2368A magenta | #E866B5 | Emotion and energy, the pink red of Apple Music |
| Books | #0E8A78 teal | #2CC0A8 | Calm and focus, the quiet of reading |
| Podcasts | #7A46D8 violet | #A888F6 | Voice and creativity, the purple people know from Apple Podcasts |
| Games | #DC6410 orange | #F59A48 | Enthusiasm, play and adventure |

Each is set per theme as `--cat-film` and so on: deeper in light so the icon reads on white (3.6:1 or more), lighter in dark so it reads on charcoal (5.3:1 or more). Film is a crimson, not the verdict red: categories tint projects and icons, and never sit beside a verdict pill. Verdicts always carry a glyph and a word, so the two never get confused

Set with `[data-cat="film"]{--cat:var(--cat-film)}` and so on. Put `data-cat` on the nav button, the project card and the body.

## 4. Type

| Role | Family | Weight | Size | Notes |
|---|---|---|---|---|
| Page title | Space Grotesk | 600 | clamp(26px, 3vw, 34px) | line height 1.1, tracking −0.025em. A title that truncates needs a line height of 1.3 or the descenders of y, g and Q are clipped |
| Bottom line | Space Grotesk | 600 | clamp(23px, 2.3vw, 28px) | max width 30ch, tracking −0.025em |
| Section, card and dialog titles (h2, h3) | Space Grotesk | 600 | 15 to 18px | tracking −0.02em. Project card names, section headings, chart and dialog titles, the receipt drawer |
| Row titles (h4) inside lists and tables, small labels | Geist | 600 | 13 to 14px | Dense rows scan better in one face |
| Marketing headlines | Space Grotesk | 600 | clamp(48px, 9.4vw, 132px) home hero, clamp(44px, 8vw, 112px) closing, clamp(32px, 4.6vw, 60px) sections; line height 0.95 to 1.02, tracking −0.04 to −0.055em | Big and tight on purpose: the flat tailed g and y carry the brand at this size |
| Body | Geist | 400 | 14.5px | line height 1.5 |
| Agent message | Geist | 400 | 15.5px | line height 1.6, no bubble |
| Label (tag) | Geist | 600 | 12px | sentence case, muted. Never uppercase or tracked |
| Numbers in tables and tiles | Geist | 600 | 28px for tiles | tabular numerals everywhere digits line up |
| Call ids, endpoints, keycaps | Geist Mono | 400 to 500 | 11 to 12px | |

Fonts load through `next/font/google`: Space Grotesk (500, 600, 700) for every title and the bottom line, Geist (400, 500, 600) for all running text, numbers and row titles, Geist Mono (400, 500) for ids and keycaps. The rule: a heading that names a page, card, section or dialog is Space Grotesk; anything you read or scan inside it is Geist. Everything in the app must read at a glance, so it uses these three clear faces and no others. Fallbacks: display falls back to Geist, then `system-ui, -apple-system, "Segoe UI", sans-serif`; mono `ui-monospace, Menlo, Consolas, monospace`.

Headings use text wrap balance. Running text stays under 70 characters wide.

## 5. Shape, space and depth

* **Radius.** Small corners. Keycaps 5. Chips, pills, receipt chips, tabs 6. Buttons, inputs, nav items 8. Rows and small cards 10. Cards, question cards, the main panel, modals, drawer and palette 12. The Tailwind scale itself is remapped in `globals.css` (`rounded-md` 6, `rounded-lg` 8, `rounded-xl` 10, `rounded-2xl` 12), so use those names, not pixel values.
* **Space.** A 4px base. Common steps: 4, 8, 12, 16, 20, 24, 32. Page padding clamp(16px, 2.4vw, 32px) at the sides and clamp(16px, 2vw, 28px) top and bottom, content up to 1280px wide, 24px between page sections. Gap between cards 12.
* **Solid surfaces with a small lift, no outlines on cards.** The main panel is `--canvas`. Cards, rows and lines on it are `--card` with `--elev-1` and no outline: they stand out by fill. Hover changes only the fill, to `--card-hover`. Default buttons, chips and the receipt chip are a solid `--button` fill with no outline, deepening to `--button-hover`. Primary buttons are solid `--primary` with a faint top highlight. Fields and message boxes keep a `--line` edge that turns accent on focus. Selected and changed states use `--accent-soft` with an accent edge. No dashed boxes.
* **Elevation.** Three steps, layered and slate tinted so they look soft, not grey. `--elev-1` for anything resting on the canvas (cards, buttons, chips): light `0 1px 2px rgba(17,17,20,.05), 0 2px 6px rgba(17,17,20,.04)`. `--elev-2` for menus and tooltips: light `0 2px 4px -2px rgba(17,17,20,.06), 0 12px 24px -4px rgba(17,17,20,.1)`. `--shadow` for dialogs, the drawer and toasts: light `0 4px 12px rgba(17,17,20,.06), 0 24px 48px -12px rgba(17,17,20,.18)`. Dark uses the same shapes in black at higher opacity. Tailwind's `shadow-xs`/`sm`, `shadow-md` and `shadow-lg` map to these.
* **No side stripes.** Never mark a card with a coloured left border. Never use dots as status markers. Use an icon, a word or a fill.

## 6. Layout

* **Shell.** Two columns on desktop: a 232px sidebar on `--bg`, and a main panel on `--canvas` with a 12px radius and a 1px `--line` edge, inset 8px from the top, right and bottom. Pages with no sidebar (landing, sign in, invite) also sit on `--canvas`, so their white cards show.
* **Sidebar.** Brand, team switcher, search button (shows ⌘K), nav, then the user block. Nav: New project (ink fill, opens `/start`), Overview (with the Needs you count, hidden at zero: the one count in the sidebar, because it asks for action), Projects, then Pinned (the person's pins, in pin order) and Recent (the five most recently updated projects not pinned), each project a row with its tinted category tile and name, then Manage (Team). The open project's row is lit; inside a project with no row, Projects is. Categories are not in the sidebar: the agent reads them from the first message, and the project list filters by them. Labels always visible while the sidebar is open; in the rail, project rows keep their tile and show the name as a tooltip.
* **Collapsed sidebar.** A toggle beside the logo, or ⌘B or Ctrl B outside a text field, collapses the sidebar to a 68px icon rail. The rail keeps every item as an icon: the team as its initial, the person as an initial in an ink circle, the Needs you count as a small badge on the icon, and group labels as dividers. Hidden labels stay for screen readers and show as a tooltip on hover and focus. The choice is remembered in the browser and applied before first paint. It only affects desktop: below 900px the top bar is unchanged.
* **Page head.** Display title and the primary action on the right. No label above the title.
* **Team.** Two columns from 1000px: members and pending invites on the left, the Invite someone card on the right and sticky. Each member is a row on a card: a round initial, the name with a You chip, the email, and a role Dropdown (descriptions explain each role) with Remove, or a plain role chip for people who cannot manage. Section headings are titles in the display face with one muted line under them, not tiny uppercase labels. One column below 1000px, and for non owners.
* **Overview.** The start message box under "What are you working on?" (§7.11). Then Needs you with a count, in two columns, each row tinted with its project's category like a project card, with no icon tile, and its category named at the start of the detail line: threads waiting on an answer, launches that are out with no results added, threads with something new, and runs in progress, in that order, each with its action word (Answer, Add results, Open, Watch). Then Pick up where you left off in two columns. One column on mobile.
* **Project grid.** Title Projects, New project on the right, then the category filter: one segmented control on a `--surface2` track (radius 10, padding 4), with All and the five categories as links. Each item is 32px tall, radius 8, with the category icon in its colour and the name, no count. The current one is a raised `--card` with ink text; the others are muted text that fills to `--surface2-hover` on hover. It scrolls sideways on a narrow screen. Cards in a grid of at least 280px columns, equal height, with the status and last update in a footer. Each card has a pin button that shows on hover or keyboard focus of the card, stays showing once the project is pinned, and always shows on touch screens; pinned projects sit in a Pinned group above the rest, newest pin first. The group headings (Pinned, Projects) show only when both groups exist; with nothing pinned the list has no heading, only a screen reader label. Pins belong to the person and only projects can be pinned. When one category is selected, a help button (a question mark icon, labelled "What Oraqul tests in <category>") sits beside the filter, so the list stays about projects. It opens a wide dialog: the category's tinted icon tile, its one line blurb and its views as chips tinted with the category colour (never the accent), then, after a `--line` divider, three columns: Tests (checked against Qloo, with a receipt), Thin data (tested at lower confidence) and You bring (not in Qloo, so the team's own numbers), each a short heading, a muted note and a plain list with no icons. A column with nothing in it is left out. One column under the other below 700px.
* **Project workspace.** The project page and a thread's page are one screen. Crumbs (Projects › category, both links, muted, no underline, lit on hover). Then one row: the 40px category tile, the display title with one muted line of meta under it (category · kind · genre · window), and Project details then New chat (primary) on the right. Then two columns on desktop. Left, 232px: the current plan as a small card (kind, label, the headline in three lines, linking to it), then the project's chats (name, New mark, outputs, who and when). Right: the open chat, filling the window height. Below 900px the current plan card sits above the chat. Below 900px the list folds into a "Chats (n)" disclosure above the chat. Project details is a wide dialog with the inputs, the plan's verdict chart, plan lineage with compare, all outputs, and Delete project for owners.
* **Output page.** Header: crumbs that stop at the project (Projects › project, both links, since the title below names the output), then the display title with its kind tag beside it, and one muted sentence-case line (who, when, the chat it came from, what it was built on; a shared link drops the chat name), with the actions on the right. Segmented tabs. Tab note. Content.
* **Chat.** The transcript and the message box sit in an 820px column centred in the chat card. Agent text left without a bubble, user text right in a soft bubble. Answered questions, the finished trace and outputs are each one line, so the conversation reads as a conversation. The message box (text and files) pinned at the bottom, one line tall until the person types more, with up to three "Next steps" chips above it.
* **Marketing pages.** Under `app/(marketing)/`, shared pieces in `app/_marketing/`. They keep the tokens and components but are allowed to sell: big Space Grotesk headlines, colour fields, art and decorative motion. Rules:
  * **One designed rhythm, not the visitor's theme.** The layout is pinned with `.scheme-light`; dark bands opt in with `.scheme-dark`. Both classes redefine every token on their element (`globals.css`), so a `VerdictPill` or card inside a dark band reads the dark tokens. The home rhythm: light hero, dark prompts, light problems, dark agent run, white taste map, light timeline, dark marked up plan, `--accent-soft` maths, light categories, white FAQ, dark closing and footer.
  * **No eyebrow labels.** A section opens with its headline (and at most one lead line). Compositions change from section to section: no repeated text left, picture right rows.
  * **The product is the picture.** Previews are built from the real components on invented data and say "Example" where data shows; never raw Qloo data or endpoint names. The hero holds a full app preview (sidebar, chat, summary) that leans back and straightens on scroll where `animation-timeline` exists, with a receipt and a verdict floating off its edges.
  * **Art.** Taste discs: each category's colour as a translucent disc, overlapping where audiences meet, which is what Oraqul measures (`taste-discs.tsx`; multiply on light, screen on dark). Text is never set over art: in the hero the discs sit behind the app preview and peek around its edges, and in the closing band they keep clear of the headline. A faint dot grid behind the hero. Category panels use the category colour mixed 74 percent into ink (so `--bg` text keeps 4.5:1 on every category, orange included) as a solid field with `--bg` text. Category colours stay off text and off verdicts; verdict colours appear only on verdicts.
  * **Headline marks.** The hero sets "Plans" in cobalt over a soft `--accent-soft` highlighter band that sweeps in, and draws a `--holds` stroke under "check". Restraint matters: one mark per verb, the rest of the headline in plain ink.
  * **Motion.** `marketing.css`: headline words rise in on load; `<Reveal>` starts a section's motion once, when an eighth of it is on screen (timeline axis draws, marks paint in, the lift marker slides); the prompt marquee and the data flow tokens loop. Every one stops under `prefers-reduced-motion`.
  * **Inner pages** open with `PageHero`: a large title, one lead, and a companion beside it that differs per page (the agent trace on How it works, the verdict legend on Example, a jump index on Use cases, colour tiles on Categories, the lift formula on Method, the four promises on Trust). The sections under it change composition from band to band: numbered steps that alternate sides, a belief to call to verdict table, ranked bars, a calendar of dates, solid category fields beside white coverage columns, a docs layout with a sticky contents list and threshold scales (`scale.tsx`), a ledger table and a roles matrix. Long reading (Method, Privacy) sits in a 68ch column with the contents list on the left from 1000px.
  * The positioning line, "A verifiable AI agent for launch strategy in media and entertainment", sits in the hero pill and the footer, and Qloo is named wherever a claim depends on it.
  * **Sticky steps** (`sticky-steps.tsx`), the scroll pattern Calendly uses: the text for each step scrolls past while one picture stays pinned beside it and swaps to the step crossing the middle of the screen; the other steps fade to 25 percent, and pictures not showing are `inert`. Used twice on the home page, no more: the four jobs in launch order (the chat for each job) and the five categories (a solid colour panel with what Oraqul tests). From 1000px; below that each step shows its picture under its text. No layered background parallax: a transformed layer also breaks the taste discs' blend mode.
  * **Signs of an agent.** Oraqul must read as an AI agent, not a dashboard, and the signs are honest ones: the sparkles icon marks the agent (the hero pill, its name in the chat, the agent run, With Oraqul), a moving bar and shimmering label while it works (`.mk-thinking`, `.shimmer-text`), a blinking caret on text it is writing (`.mk-caret`), and an agent run whose lines stream in (`.mk-stream`) with the engine's real tool names and its red team step, replayable with Run again. No glowing orbs, chat bubbles with robots or gradients.
  * **FAQ** uses native `details` disclosures. Answers say only what the product does today.
  * **Breakpoint trap.** Never set one property with both a named breakpoint (`sm:`, in rem) and an arbitrary px one (`min-[1000px]:`) on the same element: Tailwind cannot order rem against px, so `sm:` can win at every width. Use px for both (`min-[640px]:` with `min-[1000px]:`).
  * Header: logo, Product menu, Use cases, Categories, then Sign in and Create account. Footer: four columns, dark.
* **Breakpoint.** 900px. Below it the sidebar is replaced by a top bar with the brand, New, Overview, Projects, search and Team, grids become one column, the dock chat is hidden (the output page shows Open chat instead), and charts keep their table view.

## 7. Components

### 7.1 Logo
A rounded box with an "o" ring inside. Box 28px, radius 8, fill `--ink`. Ring 12px, 2.6px stroke in `--bg`. Wordmark "Oraqul" beside it in the display face at 17px, weight 600.

### 7.2 Buttons
Default: solid `--button` fill, no outline and no shadow, hover to `--button-hover`, radius 8, height 36, weight 500. Primary: solid `--primary`, `--primary-ink` text, a faint white top highlight and a small lift (`--elev-primary`, `shadow-primary`), hover to `--primary-hover`. Small: height 32, 13px. Ghost: transparent, no edge. Danger: soft red (`--breaks-bg` fill, `--breaks` text) for an action that removes something, such as Remove, Leave team and Delete project; Danger solid (`--breaks` fill) only for the confirming step (Yes, remove), so the first click is never destructive. Pressed: scale 0.98. Disabled: 45 percent opacity. Buttons are words. Only New project and New chat (plus), Send (arrow), Attach (paperclip), Delete project (bin), Ask Oraqul (sparkles) and Sign out carry an icon, and Light or dark is icon only; icon only buttons (Close) have an `aria-label`.

### 7.3 Inputs
Radius 8, padding 9 by 12, `--surface` fill and a 1px `--line` edge. Focus: 2px outline of accent at 45 percent and the edge turns `--accent`.

### 7.4 Chips
Radius 6, 12.5px. A label chip is `--surface2` with no edge. A filter or action chip is a solid `--button` fill with no outline, deepens to `--button-hover` on hover, and switches to the soft accent fill, an accent edge and accent text when selected. Only the category filters carry an icon, their category's, because it carries the category colour.

### 7.5 Verdict pill
Radius 7, 12px, weight 600, padding 2 by 9. Fill and text from the verdict tokens. Starts with a glyph: tick, half circle, cross, dotted circle. The word is always present: Holds, Weak, Breaks, Could not test.

### 7.6 Confidence
Shown as a word (High, Medium, Low, Lower) plus a three bar meter in neutral ink. Border `--line`, radius 7. Never coloured as a verdict and never a percentage.

### 7.7 Receipt chip
Small chip, radius 6, 12px, a solid `--button` fill with no outline and the label "View receipt"; hover turns it soft accent. It opens the receipt drawer. Every line that makes a claim carries one.

### 7.8 Cards and lines
Card: `--card` fill with `--elev-1` and no outline, radius 12; hover fills to `--card-hover`. Line item (`.ln`): radius 10, padding 12 by 16, title, one line of detail, verdict pill and confidence on the right. A changed line gets the soft accent fill, plus the word "Updated" and what it was before.

### 7.9 Tabs
A segmented control: `--surface2` track, radius 8, padding 4. Each tab radius 6, padding 6 by 12. The selected tab is a raised `--card`. Show four tabs by default (Summary, Plan, Assumptions, Evidence) plus the current tab. The rest sit under a "More (n)" tab that toggles to "Fewer".

### 7.10 Tab note
A single muted sentence above the content, 13.5px, max 68 characters wide. Every tab has one. Keep the wording in section 10.

### 7.11 Start message box
One card: an opening line from the agent, the message box, then "Not sure how to put it? Start from:" with three filter chips, Make a plan, Check my plan, Fix one that missed. The chips are hints, not steps: none is needed, picking one changes the opening line, the placeholder and a "You bring: ..." line, and picking it again clears it. Typed text is kept when a chip changes. A muted line says Oraqul works out the category and the job, and that the project is saved when you send. The same card sits on the overview and on `/start`. The message box takes text and files (button or drop, up to 5, 20 MB each), Enter sends and Shift Enter adds a line. Never label any of this "New project": the project is made by the first message.

### 7.12 Project card
No icon: the whole card is tinted with its category colour (`.cat-card`, §3.3), with the lift and no outline. Title, then one muted line of meta on a single line (the category name first in the All list, then kind and genre; the window lives in the chat), then a footer with the status chip on a translucent `--surface`. The updated date and the pin show only on hover or keyboard focus of the card (always on touch screens), so a resting card carries the least it can. Hover deepens the tint.

### 7.13 Summary card
In the chat an output is one line: a button with its kind and label that opens the summary card in a wide dialog, and a Full details link. The agent's message above it already says the bottom line, so the card never fills the chat. The dialog is one column: "Bottom line", the headline in the display face, confidence and its reason, "Do this" with up to three rows and their receipt chips (the receipt drawer opens over it), the verdict counts, then View full details, Copy summary and Evidence. On the output page: two columns on desktop. Left: label "Bottom line", the display headline, confidence, one sentence of why, then Copy summary, Export brief, See the evidence. Right: label "Do this" and up to three rows, each a numbered keycap, one instruction, and a receipt chip. Rows use `--surface2` fill and radius 12. One column on mobile.

### 7.14 Question card
Radius 12, padding 16, on `--inset`. The prompt in 15.5px weight 600. Options are rows (radius 10, `--card` fill on the `--inset` question card) with a keycap number on the left, label, and a muted description on the right. Hover deepens the fill. Selected gets the soft accent fill. Once answered the card folds to one muted line, a tick and "Answered: ...", closed by default; it opens to show the question.

### 7.15 Agent trace
A card (radius 14). While running: a 2px progress bar across the top, a small "Working" label with "Step n of m", and one row per step. The running row has a spinner and a shimmering label. Finished rows have a green tick. When done it collapses to "Agent trace, n steps" with a chevron. Steps are plain sentences.

### 7.16 Charts
Inline SVG or CSS. Every chart has a legend, a hover tooltip and a "View as table" toggle. Verdict colours carry a glyph in the legend. Bars grow from their baseline on first view. Series colours come from `--s1` and `--s2` and the verdict tokens, never from category colours.

### 7.17 Receipt drawer
A sheet from the right, inset 10px, radius 12, 420px wide, with a line border and the floating shadow. Contents: label "Receipt", the claim, a verdict pill, then Call id, Endpoint, Input, Returned, How it was decided, Confidence, and the example response shape in a mono code box. A note on what leaves the team and a Close button.

### 7.18 Search palette (⌘K)
A centred 600px panel, radius 12, on the scrim. Search field with an esc keycap. Results grouped as Go to, Categories, Projects, Outputs, Actions, each with its icon. Arrow keys move, Enter opens. A footer shows the keys.

### 7.19 Modal, toast
Modal radius 12, on `--canvas` (so white cards inside it show, like the main panel) with a `--line` edge and `--shadow`, closed by an icon button, on the scrim. The scrim is one plain dim for every dialog, the drawer included: ink at 64 percent in light, black at 88 percent in dark, no blur, so the page behind reads as set aside rather than washed grey. Toast: ink fill, radius 8, `--shadow`, bottom centre.

### 7.20 Icons
[Lucide](https://lucide.dev) (ISC licence) through the `Icon` component in `packages/ui`, at 1.75px stroke, 18px by default and 14 to 16px inside buttons, `currentColor`. Screens use our names, never Lucide directly, and the set holds only what is used. Icons are rare on purpose: a screen full of icons is as noisy as one with none. Use one only where it carries meaning a word does not: navigation, the five categories (with their colour), the agent's own things in accent (Next steps, Ask Oraqul, Current plan), plus, send, attach, close, pin, search, delete, sign out and the light or dark switch. Never on section titles, ordinary buttons, chips or receipt chips, and never instead of a word except an icon button with an `aria-label`.


### 7.21 Dropdown
Our own select, never the browser's. Two kinds from one component: a normal **Dropdown** for a handful of options (a role, a plan to compare), and a **SearchDropdown** when the list is long or people know the name (cities, entities), with a search box at the top of the menu.

The field is a 36px button: radius 8, `--surface` fill and a 1px `--line` edge, the chosen label, and a chevron that turns over when open; the edge turns accent while open. The menu opens under it (over it when there is less than 280px below), on `--surface` with a `--line` edge, radius 12, `--shadow`, 4px padding, scrolling past 256px. Options are rows of radius 8: the label, an optional muted description (use it for roles, so the choice explains itself), and a check in accent on the current one. The active row, by pointer or arrow keys, is `--surface2`. A search box sits above the options with a search icon and a divider; no matches says so in muted text.

Behaviour: click or Enter, Space, or an arrow key opens it. Arrow keys move, Home and End jump, Enter or a click chooses, Escape or a click outside closes, and focus returns to the field. In a normal dropdown, typing the start of a label jumps to it. In a search dropdown focus moves to the search box and the arrow keys and Enter work from there. The label is required (`hideLabel` for a field in a row that already says what it is for). Screen readers hear a combobox with a listbox of options. The menu is positioned by its field, not a portal, so it works inside cards and dialogs; do not put it inside something that clips overflow.

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
| Modal, palette, menu | Pop from 0.97 and fade, scrim fades | 160 to 260ms |
| Hover on cards | Fill deepens to `--card-hover` | 160ms |
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

Use plain words. Short sentences. No jargon without a one line explanation next to it. Say what Oraqul does. Do not list what it does not do: a sentence that opens with a limit makes the product sound smaller than it is. On the landing page, the example answer shows the product at its best, labelled as an example.

| Use | Avoid |
|---|---|
| Make a plan, Check my plan, Fix one that missed | Generate, Analyse, Run audit |
| Project, the one name for what the first message creates, whatever the job | Launch, Campaign, Release, as a name for it |
| Chat (in the UI; "thread" in code and the API) | Thread, Conversation, Session, Run |
| Launch for the discipline and the plan: launch strategy, launch plan, launch team, the week after launch | Release, go to market or rollout as the umbrella word |
| The category's own word when naming the event: a film or series release (or premiere), an album or tour, a book launch, a podcast season or launch, a game launch | One word forced on every category, such as a book release or a podcast drop |
| Holds, Weak, Breaks, Could not test | Validated, Invalidated, Inconclusive |
| Receipt (the exact Qloo call behind a claim) | Provenance, Citation, Trace id |
| Bottom line, Do this | Executive summary, Recommendations |
| Could not test | N/A, Unavailable |
| Low confidence | 42 percent |

Tab notes (keep these in the product):

* Summary: The short version: what to do first, and how sure Oraqul is.
* Audience: Who it is for, measured against Qloo taste data.
* Assumptions: Every belief your plan rests on. Holds means Qloo data supports it. Breaks means it does not. Each one has a receipt: the exact Qloo call behind it. What could not be tested is at the end.
* Plan: The plan itself, section by section, then the risks to watch.
* Risks (section at the end of Plan): Each risk has an early warning signal to watch before it goes out.
* Could not test (section at the end of Assumptions): What Oraqul could not test, and why. Nothing here is guessed. You may need to supply it.
* Evidence: Every claim with its receipt. Use this to check any number.
* What changed: What moved compared with the plan before.
* Results: The results you added, compared with what the plan expected.
* Date check: How each date overlaps with rival releases. Lower overlap is better.
* Partner briefs: Drafts for partners. Nothing is sent from here.
* Territories: Where to open first, ranked by how strongly each territory fits.
* Tour route: The tour stops in order, with how well each city fits.
* Support acts: How each support act fits in each city on the route.
* Comp shelf: The comparable titles whose readers are closest to yours.
* Adaptation bridge: Screen and audio titles your readers also love.
* Topic map: Topics your listeners like that rival shows do not own.
* Fan base bridge: Other fan bases that overlap with your players.
* Regions: Regions ranked by fit, against the lead region the plan names.

Never write: forecasts, sales promises, or anything that suggests the agent sent something.

## 11. Implementation

### 11.1 Token block
Copy this shape exactly. Light on bare `:root`. Dark redefined in the media query (guarded) and again under `[data-theme="dark"]`. Add `color-scheme: dark` in both dark blocks. Give `body` its background from a token.

```css
:root{
  --bg:#FFFFFF;--canvas:#F2F2F4;--surface:#FFFFFF;--surface2:#ECECEF;--surface2-hover:#E3E3E7;
  --card:#FFFFFF;--card-hover:#F6F6F8;--ink:#111114;--muted:#5A5A63;--line:#E6E6EA;
  --primary:#1E47C2;--primary-hover:#1A3DA8;--primary-ink:#FFFFFF;
  --accent:#1E47C2;--accent-ink:#FFFFFF;--accent-soft:#EAF0FF;
  --holds:#167A40;--holds-bg:#E8F5EC;--weak:#8A5800;--weak-bg:#FBF2D9;
  --breaks:#BE3128;--breaks-bg:#FCEBE9;--cant:#5A5A63;--cant-bg:#ECECEF;
  --elev-1:0 1px 2px rgba(17,17,20,.05),0 2px 6px rgba(17,17,20,.04);
  --elev-2:0 2px 4px -2px rgba(17,17,20,.06),0 12px 24px -4px rgba(17,17,20,.1);
  --shadow:0 4px 12px rgba(17,17,20,.06),0 24px 48px -12px rgba(17,17,20,.18);
  --s1:#1E47C2;--s2:#8A8A94;--good:#167A40;--warn:#B7780A;--crit:#BE3128;--na:#8A8A94;--grid:#E6E6EA;
  --f-display:"Space Grotesk","Geist",system-ui,-apple-system,"Segoe UI",sans-serif;
  --f-body:"Geist",system-ui,-apple-system,"Segoe UI",sans-serif;
  --f-mono:"Geist Mono",ui-monospace,Menlo,Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#09090A;--canvas:#0E0E10;--surface:#141417;--surface2:#26262B;--surface2-hover:#2E2E34;
  --card:#1B1B1F;--card-hover:#232328;--ink:#F2F2F4;--muted:#9A9AA3;--line:#27272C;
  --primary:#2B54D4;--primary-hover:#3460E0;--primary-ink:#FFFFFF;
  --accent:#8AA9FF;--accent-ink:#06101F;--accent-soft:#1C2440;
  --holds:#5CC98B;--holds-bg:#10251A;--weak:#E3AE4A;--weak-bg:#2A2010;
  --breaks:#F27A6F;--breaks-bg:#2F1715;--cant:#9A9AA3;--cant-bg:#26262B;
  --elev-1:0 1px 2px rgba(0,0,0,.5),0 2px 8px rgba(0,0,0,.25);
  --elev-2:0 2px 4px -2px rgba(0,0,0,.4),0 12px 24px -4px rgba(0,0,0,.5);
  --shadow:0 4px 12px rgba(0,0,0,.3),0 24px 48px -12px rgba(0,0,0,.6);
  --s1:#8AA9FF;--s2:#74747D;--good:#5CC98B;--warn:#E3AE4A;--crit:#F27A6F;--na:#74747D;--grid:#27272C;color-scheme:dark}}
:root[data-theme="dark"]{ /* same dark values as above */ color-scheme:dark }
body{background:var(--bg);color:var(--ink)}
```

### 11.2 Next.js notes
* Put tokens in `globals.css`. Load fonts with `next/font/google` (Space Grotesk, Geist, Geist Mono) and map them to `--f-display`, `--f-body`, `--f-mono`. 
* Build the components in section 7 as one small set: Button, Input, Chip, VerdictPill, Confidence, ReceiptChip, Card, Line, Tabs, TabNote, StartComposer, ProjectCard, SummaryCard, QuestionCard, Trace, Chart, ReceiptDrawer, Palette, Modal, Toast, Icon.
* Verdict and confidence components take the data value and render the glyph and word themselves, so no screen can show colour alone.
* The prototype's CSS is the working reference: `src/css/04_theme_calm.css` holds the tokens and theme, on top of `01_base.css`, `02_categories.css` and `03_motion_and_shared.css`.
* Behaviour reference: `src/js/07_fx.js` for the palette and view animations, and `src/js/03_core.js` for the word by word reveal and the seen tracking of new messages.

### 11.3 What to test with real people
Show five or six launch marketers, including Nigerian users on mid range Android. Watch for: do they start with one message without help, do they correct a wrong guess by typing, do they understand Holds and Breaks without the note, and do they open a receipt unprompted. Fix wording before fixing visuals.
