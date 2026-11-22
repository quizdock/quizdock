# QuizDock — Specifications (index)

> The hub of the project's **reference specifications**. For a general presentation, see the **[root README](../README.md)**. The living development documentation is in **[../docs/](../docs/README.md)**.

> **A Kahoot clone**: real-time interactive quizzes, timed, scored on how fast people answer. 10–200 participants per session.

🚧 **Status: specification phase** (no code yet). These design documents are authoritative for the development.

---

## 📚 Specification documents

Read them in this order to discover the project:

| # | Document | Contents | For whom |
|---|----------|----------|----------|
| 1 | **[SPECIFICATIONS-METIER.md](./SPECIFICATIONS-METIER.md)** | Vision, actors, journeys, business rules (RG-xx), reporting, MoSCoW prioritisation | Product, hosts, the whole team |
| 2 | **[SPECIFICATIONS-UI.md](./SPECIFICATIONS-UI.md)** | Wireframes of the screens (host console, projection, participant mobile), ergonomics | Design, frontend |
| 3 | **[SPECIFICATIONS.md](./SPECIFICATIONS.md)** | Architecture, stack, scoring, timing, the WebSocket contract, REST, Docker, tests, CI | Backend, frontend, DevOps |
| 4 | **[SPECIFICATIONS-DONNEES.md](./SPECIFICATIONS-DONNEES.md)** | Data dictionary (PostgreSQL + Redis), enums, data protection, indexes | Backend, data |
| 5 | **[SPECIFICATIONS-SEQUENCES.md](./SPECIFICATIONS-SEQUENCES.md)** | Sequence diagrams (Mermaid) of the key flows | Backend, frontend |
| 6 | **[SPECIFICATIONS-ROADMAP.md](./SPECIFICATIONS-ROADMAP.md)** | Milestones from v0.1.0 on (an open `0.x` series), tasks per phase, dependencies; v1.0.0 **not planned** (it is earned) | Lead, product, the whole team |
| 7 | **[SPECIFICATIONS-LIVE.md](./SPECIFICATIONS-LIVE.md)** | The live game: a presenter across several windows (projection + control, cross-device), player screens, late join, reconnect and persistence, `HOST_DISCONNECTED`, the state→screen matrix | Frontend, backend |
| 8 | **[SPECIFICATIONS-MEDIA.md](./SPECIFICATIONS-MEDIA.md)** | Audio & video in questions: the phased brief, the decisions taken, the phases to come, the idea box (microphone) | Frontend, backend, product |
| 9 | **[SPECIFICATIONS-MEDIA-LIBRARY.md](./SPECIFICATIONS-MEDIA-LIBRARY.md)** | Media library & converter: target formats encoded in the browser, file/use split and deduplication, the media input module, credits, the admin page | Frontend, backend, product |
| 10 | **[SPECIFICATIONS-STORE.md](./SPECIFICATIONS-STORE.md)** | Community store (#21): the model (author repositories, registry, copy never reference), the decisions taken, what is delivered, the ordered road to opening | Product, backend, frontend |
| 11 | **[SPECIFICATIONS-ROOM.md](./SPECIFICATIONS-ROOM.md)** | Multi-quiz room (#89): every session a room, the live state split between the room and each game, lifecycle, archives, the ordered pull requests | Backend, frontend, product |
| 12 | **[SPECIFICATIONS-IMAGE-CHOICE.md](./SPECIFICATIONS-IMAGE-CHOICE.md)** | Image choice (`image_choice`): answers that are pictures, the decisions taken (alt per option, single or multiple, tiles, bundle v6), the phases | Backend, frontend, product |
| 13 | **[SPECIFICATIONS-UI-SYSTEM.md](./SPECIFICATIONS-UI-SYSTEM.md)** | UI system: the cross-cutting rules (actions, vocabulary, frames, contrast, permissive validation in four levels) and the three-lot rework (live, authoring, entry/account/back office), decisions taken, open points | Design, frontend, product |
| 14 | **[SPECIFICATIONS-THEMING.md](./SPECIFICATIONS-THEMING.md)** | Theming: quiz themes (library, child themes of shipped themes, slots, icons, fonts, sounds, motion), bundle v8 and the theme bundle, instance branding and interface theme, dark mode, themes in the store | Design, frontend, backend, product |
| 15 | **[SPECIFICATIONS-SELECTION.md](./SPECIFICATIONS-SELECTION.md)** | Selections (delivered on `dev`): a named, saved, shareable list of quizzes launched into a room; the word chosen, what it holds (only what depends on the quizzes), references not copies, the queue, what each one sees, saving a room, launches compared | Product, backend, frontend |
| 16 | **[SPECIFICATIONS-SHARED-PLAY.md](./SPECIFICATIONS-SHARED-PLAY.md)** | Presenting a shared quiz (delivered on `dev`): other hosts present it as it is, keeping nothing; ratings without nicknames; *share* vs *offer as a template* | Product, backend, frontend |
| 17 | **[SPECIFICATIONS-QUESTION-TIMELINE.md](./SPECIFICATIONS-QUESTION-TIMELINE.md)** | The question timeline (draft): the builder interface that places a question's media and lays out its flow to scale; conflicts flagged, never arbitrated | Product, frontend |
| 18 | **[SPECIFICATIONS-HINTS.md](./SPECIFICATIONS-HINTS.md)** | Hints (draft, discussion #288): a collective clue on the timeline, a configurable penalty on the question's points, the host's switch, three lots | Product, backend, frontend |
| 19 | **[SPECIFICATIONS-QUESTION-PICTURE.md](./SPECIFICATIONS-QUESTION-PICTURE.md)** | How a question's picture is shown (draft): ratio (presets or free), fill, crop point, progressive reveal; one `mediaStyle` field | Product, frontend, backend |
| 20 | **[SPECIFICATIONS-STEP-EDITOR.md](./SPECIFICATIONS-STEP-EDITOR.md)** | One editor for every step (draft): questions and slides share the frame, the preview, the timeline and the media model; the data stay apart; three lots | Product, frontend |
| 21 | **[SPECIFICATIONS-ROLLBACK.md](./SPECIFICATIONS-ROLLBACK.md)** | Version rollback (draft): a `down.sql` per migration, three releases back at least, the backup as fallback; the admin says and gives the command, the server runs it | DevOps, backend, product |

> The documents refer to one another (for instance `technique §5`, `RG-13`, `données §2.10`). Any change of behaviour must update **the document it concerns, in the same commit** (see the "test & document" policy, technique §18).

---

## 🎯 In short

- **Context**: a company, a session. **v1 mode**: classic, individual. **Quizzes**: private (the host's own bank).
- **Scoring**: correctness **and** speed (an instant answer scores the maximum; at the time limit, half) plus a streak bonus. Timing is **authoritative on the server**.
- **Taking part**: as a guest (PIN + nickname) **or** signed in (SSO) — mixed authentication.
- **Anti-cheat**: the right answer is **never** sent to the client before the reveal.

---

## 🧱 Technical stack (settled decisions)

| Layer | Choice |
|--------|-------|
| Monorepo | **pnpm** workspaces (front + back + `@quiz-dock/contracts`) |
| Frontend | **React + Vite + TypeScript**, **shadcn/ui** with **lucide-react** icons, **TanStack** Query/Form/Router/Table, a REST client generated by **Orval** |
| Backend | **Node.js + TypeScript (NestJS)** + **Socket.IO** |
| Real time | Socket.IO + the **Redis adapter** |
| Live state | **Redis** (the source of truth while a game runs) |
| Persistence | **PostgreSQL 16** (Prisma ORM), **ULID** keys |
| Auth | **OIDC (JWT)** — Keycloak as the reference IdP — `AUTH_MODE=none\|oidc` (authentication is optional) |
| Media | A **local volume** served by the backend (self-hosted, no object service) |
| Front/back sync | OpenAPI generated automatically (`@nestjs/swagger`) → **Orval** for REST; a shared TS contracts package for the WebSocket |
| Containers | **Docker Compose** (front, back, postgres, redis, keycloak, storage) |
| Tests | **Jest** (back) + **Vitest** (front) + Playwright (e2e) + k6 (load) |
| CI | **GitHub Actions**; **Husky** git hooks (pre-commit / commit-msg / pre-push) |

Details and reasoning: [SPECIFICATIONS.md §2](./SPECIFICATIONS.md).

---

## 🚀 Launching it (the target, once the code exists)

```bash
pnpm install                 # installs the monorepo and the Husky hooks
docker compose up -d         # the full development stack
# Front: http://localhost:5173   API: http://localhost:3000   API docs: /api/docs
```

> Under `AUTH_MODE=none` the Keycloak service is not started (the Compose profile `keycloak`). See [SPECIFICATIONS.md §16](./SPECIFICATIONS.md).

---

## 🗺️ The v1 scope and beyond

- **v1 (Must)**: a private quiz builder, every question type, an individual live session (lobby→podium), joining as a guest or through SSO, time-and-streak scoring, reporting and CSV export.
- **Optional in v1**: history for signed-in participants, archiving, **full-capture mode** (audit and certification, with a notice to the participants).
- **Backlog**: team mode (v1.1), asynchronous / homework mode (v1.2), sharing and a public library, an aggregated admin dashboard, an avatar generator (multiavatar).

Details: [SPECIFICATIONS-METIER.md §13](./SPECIFICATIONS-METIER.md).

---

## 📌 Documentation conventions

- A **settled decision** is marked as such; the alternatives that were dropped are kept along with the reasoning.
- The **business rules** are numbered `RG-xx` (quick reference: [métier §12](./SPECIFICATIONS-METIER.md)).
- Cross-document references use the forms `technique §N`, `métier §N`, `données §N`, `séquences §N` — the document names are kept as they are so the references in the code still resolve.
- Current version of the specs: **1.0 — 2026-06-09**.
