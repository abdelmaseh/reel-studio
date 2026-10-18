# Behavioural eval of the worker agents

Run by a fresh session on a named recording the owner chose, judged against a reviewed reference file. The reference and every score stay in `state/evals/` (ignored); the repo ships only the scorer and a synthetic fixture.

## Reference

`state/evals/<name>/expected.json` (schema: `tests/fixtures/agent-eval/expected-sample.json`): style and reason words, hook start, beat count range, the key clauses with their expected visual kind, retake row ids to flag, sound band and no-whoosh, ending grammar, pass bar. The owner reviews it once; its `reviewedBy` names them.

## Run

1. New project `Projects/eval-<name>-<yyyymmdd>/` with a `production-request.json` listing every role as its own task (analysis → editorial → edit ∥ assets → sound → qa; no delivery), `interaction: "delegated"`, the named recording as the one source.
2. Big-job staffing is forced: every worker runs as its own agent from its definition, even for a short recording. The manager reviews with `production-accept.mjs` before accepting, integrates with `plan --replace`, prepares, renders the fast preview, then starts qa.
3. No `Outputs/`, no delivery render, no commit. Transcription, prepare and render run one at a time.

## Score

`node scripts/agent-eval.mjs score --run Projects/eval-<name>-<date>/production/<run> --expected state/evals/<name>/expected.json --out state/evals/<name>/runs/<date> --transcript Projects/eval-<name>-<date>/transcript/captions.json`
writes `score.json` (hard and soft deterministic rows) and `judge-brief.md`. Then start the `reel-eval-judge` agent with the brief; it writes `score.md` in the same folder.

## Pass bar

Zero hard breaks (no invented on-screen text, sign-off uncovered, keyword on screen) and ≥ 80 % soft matches after the judge's clause rows are added. The owner reads the first `score.md` before the bar counts; a failing criterion is a defect in a definition or knowledge pack, fixed there and re-run.
