Goal (incl. success criteria):
- Dodać auto pull po „unhide” (gdy okno Logseq znów jest widoczne), żeby od razu zsynchronizować zmiany z remote (obok istniejącego pull/fetch w interwale).
- Sukces: po przejściu `visibilityState` na `visible` plugin uruchamia `fetchAndMaybeAutoPull()` zgodnie z ustawieniami; autopush na `hidden` pozostaje bez zmian.

Constraints/Assumptions:
- Repo: `/mnt/c/projects/logseq-plugin-git` (plugin Logseq, TypeScript/React).
- Nie zmieniamy workflow użytkownika (auto pull tylko tam, gdzie ma to sens; bez wymuszania merge przy lokalnych zmianach).
- `dist/` jest ignorowane przez `.gitignore`, więc zmiany dotyczą `src/`.

Key decisions:
- Na zdarzeniu `visibilitychange` dla `visible` wywołać `fetchAndMaybeAutoPull()` (to już ma logikę: fetch + opcjonalny auto pull tylko gdy repo clean i ustawienie włączone).

State:
- Done:
  - 2026-01-19 19:16:31 Utworzono `CONTINUITY.md` i zebrano kontekst repo.
  - 2026-01-19 19:19:45 Dodano auto `fetchAndMaybeAutoPull()` po `visibilitychange` → `visible` (obok istniejącego autopush na `hidden`).
  - 2026-01-19 19:19:45 `pnpm build` zakończone sukcesem.
- Now:
  - 2026-01-19 19:21:05 Odpowiedź do użytkownika + instrukcja szybkiego testu w Logseq.
- Next:
  - Sprawdzić, czy po powrocie okna na wierzch uruchamia się `fetchAndMaybeAutoPull()` (wymaga włączonego `autoFetchIntervalSeconds > 0` lub `autoPullWhenRemoteChanged`).
- Open questions (UNCONFIRMED if needed):
  - UNCONFIRMED: Czy auto pull na `visible` ma działać zawsze, czy tylko gdy `autoFetchIntervalSeconds > 0` / `autoPullWhenRemoteChanged`?
- Working set (files/ids/commands):
  - `src/main.tsx`
  - `CONTINUITY.md`
  - `pnpm -s build`
