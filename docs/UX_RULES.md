# UX rules

How SkinScan screens must behave. They sit on top of the Dr. Maher design
system (colours, type, components: `app/globals.css`, `app/theme.css`) and
the product's safety rules (no diagnosis, no fabricated numbers, withhold
what is unreliable: docs/SCORING.md). Each rule names the guideline it comes
from (WCAG 2.2, Apple HIG, Material Design, via the `ui-ux-pro-max`
guideline set) so it can be checked. A change that breaks a rule needs a
reason written next to it.

## 1. Every screen

| # | Rule | Source |
|---|---|---|
| G1 | **One primary action per screen.** Other actions use the ghost or link style and sit beside or below it. | `primary-action` |
| G2 | **Sentence case** for headings, buttons and labels ("Book a consultation", not "Book a Consultation"). Arabic has its own native wording, never transliterated. | design system |
| G3 | **Touch targets ≥ 44 × 44 px** (≥ 24 × 24 px for pointer-only controls), with ≥ 8 px between them; a small visual control gets an invisible larger hit area. | `touch-target-size`, `web-target-size`, `touch-spacing` |
| G4 | **Meaning never by colour alone.** Every coloured state also has a word (band, confidence, status) or an icon. | `color-not-only` |
| G5 | **Text contrast ≥ 4.5:1** (3:1 for text ≥ 24 px); nothing a patient must read is lighter than the `muted` token. | `color-contrast` |
| G6 | **Visible focus** on every control (the design system's 2 px ring); keyboard order follows the visual order; icon-only buttons have an `aria-label`. | `focus-states`, `keyboard-nav`, `aria-labels` |
| G7 | **Respect reduced motion**: no lifts, smooth scrolls or pulses when `prefers-reduced-motion` is set. | `reduced-motion` |
| G8 | **No horizontal scroll** at 375 px; layouts are written phone-first. | `horizontal-scroll`, `mobile-first` |
| G9 | **Async actions show progress and failure where they happen**: the button disables and says what it is doing; a failure appears next to it with a way to retry. | `loading-buttons`, `error-placement`, `error-recovery` |
| G10 | **Bilingual parity**: every string exists in English and Arabic (`tests/i18n.test.ts`), layouts mirror under `dir="rtl"` with logical properties, directional icons flip. | design system |

## 2. Results ("report") page — `components/Results.tsx`

| # | Rule | Source |
|---|---|---|
| R1 | **Answer first.** On a phone the results list is the first thing after the page title; the photo, analysis confidence and extras come after it. | `content-priority`, `visual-hierarchy` |
| R2 | **Each result appears once** on the overview: one row per characteristic with score, band, confidence and meter — no second summary of the same results. | `whitespace-balance`, `progressive-disclosure` |
| R3 | **A score always carries its words**: "36/100 · Mild · High confidence". The band word and the confidence word are shown, not just coloured. | `color-not-only`, product rule "every score comes with a confidence" |
| R4 | **"Not assessed" explains itself.** A withheld result shows, in its row, why it was withheld and what would fix it (the engine's own reason), and the page offers to scan again when a better photo would help. A withheld result never looks like an error or a zero. | `empty-states`, `error-recovery`, product rule "no fabricated numbers" |
| R5 | **Not a diagnosis, before and after.** A one-line reminder sits under the title (before any score); the full disclaimer stays at the end of the page and in the PDF. | product rule "informational only" |
| R6 | **Primary action: book a consultation.** "Download report" and "Scan again" are secondary and sit with it at the end of the page; nothing in the header competes with the results. | `primary-action` |
| R7 | **Details on demand.** How each score is measured opens from its row (info dialog); the method, full explanations and experimental sections live below or in the "Detailed analysis" tab. Experimental parts are labelled "Experimental". | `progressive-disclosure` |
| R8 | **Overlay controls are real buttons** with ≥ 44 px height, the current layer marked (`aria-pressed`/active style), and the photo stays readable with every layer off. | `touch-target-size`, `nav-state-active` |

## 3. Checking a change

1. `npm test` (includes the string-parity test).
2. Open a result at 375 px and 1280 px, English and Arabic (with
   `SKINSCAN_REQUIRE_AUTH=false` in `.env.local` locally) and walk the rules
   above: answer visible on the first phone screen, no duplicate results,
   every withheld row explains itself, one primary button, targets ≥ 44 px.
3. Keyboard only: tab through the page; every control is reachable, its
   focus ring is visible, and dialogs close with Escape.
