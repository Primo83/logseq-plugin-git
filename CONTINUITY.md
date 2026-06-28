Goal (incl. success criteria):
- Przebudować wtyczkę (`pnpm -s build`) i potwierdzić brak błędów w buildzie.

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
  - 2026-01-19 19:28:47 `pnpm build` zakończone sukcesem (ponownie).
  - 2026-01-19 19:28:47 Commit: `feat: auto pull on app visible` (7bdafdf).
  - 2026-01-19 19:28:47 Push do `origin/workspace-root-scope` zakończony sukcesem.
  - 2026-02-05 14:21:44 `pnpm -s build` zakończone sukcesem (ostrzeżenie: `caniuse-lite` outdated).
- Now:
  - 2026-02-05 14:21:44 Przebudowa zakończona; oczekiwanie na dalsze instrukcje.
- Next:
  - Brak.
- Open questions (UNCONFIRMED if needed):
  - UNCONFIRMED: Czy auto pull na `visible` ma działać zawsze, czy tylko gdy `autoFetchIntervalSeconds > 0` / `autoPullWhenRemoteChanged`?
- Working set (files/ids/commands):
  - `src/main.tsx`
  - `CONTINUITY.md`
  - `pnpm -s build`

2026-06-28 update:
- Done:
  - 2026-06-28 18:09:24 Usunieto startup probe `logseq.sdk.git.exec_command(['status'])`, dodano wykrywanie repo nadrzednego dla grafu w podkatalogu, pathspec grafu oraz probe bezposredniego systemowego `git` przed fallbackiem do Logseq API.
  - 2026-06-28 18:09:24 `corepack pnpm@8.6.10 build` zakonczone sukcesem (ostrzezenie: `caniuse-lite` outdated).
  - 2026-06-28 18:12:27 Lokalny smoke: `DEFAULT-NOTES\.git` wskazuje na cache Logseq, cache `.git` jest junction do `C:\PGMPI-DATA-STRATEGY\.git`, a `git -C DEFAULT-NOTES status/fetch/push --dry-run` trafia w repo parent.
- Now:
  - 2026-06-28 18:09:24 Zmiany wtyczki sa zbudowane w `dist/`; lokalny runtime Logseq zostal przetestowany z grafem `C:\PGMPI-DATA-STRATEGY\DEFAULT-NOTES` i repo parent `C:\PGMPI-DATA-STRATEGY`.
- Next:
  - Opcjonalnie: realny commit/push z poziomu Logseq po pojawieniu sie nowej zmiany w notatkach.
- Working set:
  - `src/main.tsx`
  - `src/helper/git.ts`
  - `src/helper/constants.ts`
  - `corepack pnpm@8.6.10 build`
