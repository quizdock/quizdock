# QuizDock — Theming: quiz themes, instance look, dark mode

> **Intent, not yet the code.** This document records the decisions taken in October 2026 on theming, before any of
> it is implemented. Once a lot ships, what it changed is described in [`docs/`](../docs/README.md) and this page keeps
> only what is still to do.

Three needs, delivered in this order:

1. **Lot 1 — Quiz themes**: the look and feel of a quiz on the live screens (backgrounds, answer slots, font, sounds,
   motion), from a shared library of themes.
2. **Lot 2 — Instance look** (shipped): the organisation's identity (branding) and the look of the interface (theme), set in
   the administration.
3. **Lot 3 — Dark mode** for the interface (shipped).

The two theme layers never mix: a **quiz theme** dresses the live game (projection and players); the **interface
theme** dresses the application. The console, the editor and the back office never take a quiz theme, save the marks and colours of the console's answers.

---

## 1–3. Lot 1 — Quiz themes, shared building blocks, bundle v8: shipped

What lot 1 built — the background object, the accessibility check, the fonts, the quiz
themes and their library, the icon bank, the live rendering, bundle version 8 and the
theme bundle — is described in [`docs/themes.md`](../docs/themes.md) and
[`docs/quiz-bundle.md`](../docs/quiz-bundle.md). Decisions taken on the way, which lots 2
and 3 build on: the text and icons on the answers are always white; the answers' colours
come in the order green, red, blue, yellow…; Classic marks its answers with animals; a
theme may mark them with letters or numbers instead; only an accessible theme says so,
and the accessible shipped themes are *High contrast* and *High contrast light*.

Lot 1 is complete. The icons are checked as different files, not by their silhouette (a
rasterised comparison was judged not worth it); the font's size is the application's, not
the theme's, so it is not checked.

---

## 4. Lot 2 — Instance look: shipped

What lot 2 built — the Branding and Interface spaces, the look and its operations, the
showcase backgrounds — is described in [`docs/look.md`](../docs/look.md). Decisions taken
on the way, which lot 3 builds on: the main colour is one colour for light and dark mode,
under white text, never derived into a scale; only links are lightened on the dark page
(to 7:1); the watermark is the logo's shape in the text's colour (QuizDock's mark without
its square); the tokens that fell short of 4.5:1 were darkened — the grey of secondary
text, the amber and the new green and red text tokens on their tints, the main action's
green under white text.

### Still to do

The identity provider's sign-in page (Keycloak or another): the provider can be anything. A documentation note points
to its own theming.

---

## 5. Lot 3 — Dark mode: shipped

Described in [`docs/look.md`](../docs/look.md) (*Light or dark*). Every interface screen was
checked in both modes with a contrast measure of each visible text, not Playwright
screenshots; the live screens and their miniatures stay light.

---

## 6. Community store

Done on the store's side: the author template is `quizdock/quizdock-extensions` (a `themes/<slug>/`
folder next to `quizzes/`), the registry `quizdock/quizdock-store`; the publication action builds the
theme zips and lists them in `index.json` (`kind`, `themes`), checking the theme's licence (CC0, CC BY,
CC BY-SA) and an imported font's (OFL or the same three), credits a warning.

A theme carries a licence, set in the theme editor and written to its export.

Still to do: the store page in QuizDock — a **Themes** tab, installing a theme as a copy into the library — waits with
the store's integration into the app.

---

## 7. Open points

None. The size of the shipped themes' assets (fonts about 490 KB, the icon bank about 600 KB, the
seasonal pictures about 60 KB) was given no budget: they load only when a theme uses them, so they
cost the image about 1.1 MB and no page anything.
