---
"agent-engineering": patch
---

Upgraded template 60d14c2 to c8ff27c and moved the kernel Pin from 1f871cf to 87d23cf. Tests now run in one test-run folder through scripts/test-run.ts, the recorded size check measures both revisions under the base revision's Fallow settings, and the hosted growth step fails on a pull request with no base commit.
