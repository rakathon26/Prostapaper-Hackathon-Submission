# Review lifecycle regressions

Run from `apps/web` with Node 22:

```sh
node node_modules/vite/bin/vite.js --config tests/browser/vite.config.ts
```

Open <http://127.0.0.1:5192/tests/browser/index.html>. The page runs six assertions and displays `PASS` or `FAIL`, then `DONE`. Reload to rerun.

These tests mount the real case screen, dialogs, query cache and review mutation hook. Only the HTTP transport is replaced with synthetic responses; no backend or credentials are used. They cover focus refresh with a field draft or decision note, stale-revision comparison, initialization recovery with the original request ID, validation without a retry loop, and the lesion-only review scope.
