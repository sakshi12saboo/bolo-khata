# Bolo Khata: task plan and progress log

Plan: docs/superpowers/plans/2026-11-05-bolo-khata.md. Spec: docs/superpowers/specs/2026-11-05-bolo-khata-design.md.
Rule for this run: everything local. No deploys, no GitHub repo, no public URLs (scripts/publish.sh is prepared, not run).

| # | Task | Status |
|---|---|---|
| 1 | Reuse search (GitHub) + dependency audit + scaffold | done: no starter worth adopting; pinned deps, 0 vulns |
| 2 | Domain logic, TDD (money, units, matching, bills, ledger, stock, queries, WhatsApp, intake, seed) | done: 81 domain tests |
| 3 | /api/understand: Gemini JSON schema, zod, 8 s timeout, 1 MB cap, rate limit; local Vite mount | done: 22 API contract tests |
| 4 | Live eval, 25 utterances + 13 held-out; prompt iteration | done: 100% intent on both sets (gemini-3.5-flash) |
| 5 | Real audio through the audio path (say -v Lekha, ffmpeg webm/opus) | done: sale, payment, query all correct |
| 6 | Mobile UI: mic, carbon-slip bill, khata, stock, PWA | done |
| 7 | Playwright smoke, screenshots, 72 s demo video | done: submissions/demo/bolo-khata-demo.mp4 |
| 8 | Model comparison (2.5-flash, 3-flash-preview, 3.5-flash, 3.8-flash); default switched to gemini-3.5-flash | done |
| 9 | Cloud Run entry point + Dockerfile (built and run locally, not deployed) | done |
| 10 | Vercel function verified with an offline `vercel build` in a scratch copy + direct invoke | done |
| 11 | README, publish.sh, decisions | done |
| 12 | Publish (GitHub, Vercel, optional Cloud Run) | waiting for Sakshi's approval |

## Log
- 5 Nov 2026 13:55 Spec read, plan written, GitHub reuse search (nothing adoptable), deps pinned to releases at least 2 weeks old.
- 14:00 Domain TDD complete (phonetic folding added after "chini" failed to match "cheeni").
- 14:05 API live on real Gemini; first eval 25/25 intent, 24/25 fields. Paraphrased 4 cases that echoed prompt examples.
- 14:10 Added paidRupees (purchase + money handed over) and pack-size conversion (1 litre milk = 2 x 500 ml). Held-out set added.
- 14:15 Audio test through the real audio path: correct.
- 14:20 UI built; screenshots reviewed; perforation, compact dock and plural fixes.
- 14:25 Coordinator asked for model comparison and Cloud Run. 3.x needs thinkingLevel (MINIMAL rejected by 3.8, LOW works on all). Default now gemini-3.5-flash.
- 14:35 Final verification: typecheck, 103 unit tests, e2e smoke, eval 25/25 + 13/13, audio, demo re-recorded (71.9 s).
