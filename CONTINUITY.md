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

2026-07-01 update:
- Done:
  - 2026-07-01 14:54:06 Europe/Warsaw: Uzytkownik pokazal nowy blad Logseq: `warning: unable to access '.git/config': Permission denied`; zidentyfikowano, ze fallback do `logseq.App.execGitCommand` nadal moze uruchamiac wadliwa sciezke Git API Logseq.
  - 2026-07-01 15:00:00 Europe/Warsaw: Dodano ustawienie `gitHelperUrl` i usunieto fallback do `logseq.App.execGitCommand`; plugin najpierw probuje bezposredniego `child_process`, a potem lokalnego helpera HTTP.
  - 2026-07-01 15:00:00 Europe/Warsaw: Dodano lokalny helper `helper/logseq-git-helper.cjs` oraz launcher `helper/start-logseq-git-helper.ps1`, ograniczone do lokalnych requestow i rootu `C:\PGMPI-DATA-STRATEGY`.
  - 2026-07-01 15:00:00 Europe/Warsaw: Helper uruchomiony na `127.0.0.1:17838`; `/health` dziala, `git status --short --branch` przez `/git` zwraca `## main...origin/main`, a sciezka poza allowed root jest blokowana HTTP 400.
  - 2026-07-01 15:03:40 Europe/Warsaw: `corepack pnpm@8.6.10 build` zakonczone sukcesem; Logseq zrestartowany, po minucie smoke w `main.log` brak nowych bledow `[Git]`, `Permission denied`, `unable to move`, `invalid gitfile` i `fatal`.
  - 2026-07-01 15:03:40 Europe/Warsaw: Dodano i uruchomiono odtwarzalny autostart per-user przez `helper/install-logseq-git-helper-startup.ps1`; skrót Startup wskazuje launcher helpera dla `C:\PGMPI-DATA-STRATEGY` na porcie `17838`.
- Now:
  - 2026-07-01 15:03:40 Europe/Warsaw: Gotowe do commita i pushu source+dist na `origin/workspace-root-scope`.
- Next:
  - Commit i push source+dist na `origin/workspace-root-scope`; potem sprawdzic `HEAD...origin/workspace-root-scope = 0 0`.
- Working set:
  - `src/helper/git.ts`
  - `src/helper/constants.ts`
  - `helper/logseq-git-helper.cjs`
  - `helper/start-logseq-git-helper.ps1`
  - `helper/README-logseq-git-helper.md`
  - `dist/`
