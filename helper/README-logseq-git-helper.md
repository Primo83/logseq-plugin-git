# Logseq Git Helper

This helper is a local-only workaround for Logseq runtimes where the plugin
cannot access Node `child_process`, and `logseq.App.execGitCommand` touches the
wrong `.git` directory for a graph stored under a parent Git repository.

Default setup for this machine:

```powershell
powershell -ExecutionPolicy Bypass -File C:\projects\logseq-plugin-git\helper\start-logseq-git-helper.ps1
```

The helper listens on `http://127.0.0.1:17838/git` and only accepts local
requests for `git -C` paths inside `C:\PGMPI-DATA-STRATEGY`.

Health check:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:17838/health
```

Install per-user autostart after Windows login:

```powershell
powershell -ExecutionPolicy Bypass -File C:\projects\logseq-plugin-git\helper\install-logseq-git-helper-startup.ps1
```
