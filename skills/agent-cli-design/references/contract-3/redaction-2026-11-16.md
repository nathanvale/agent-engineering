# Contract 3.0 path redaction, 16 November 2026

Status: applied. This is a provenance-only revision of the accepted Contract
3.0 documents. It changes no rule, clause identifier, table, example or
verdict.

## Authority and scope

Nathan instructed on 16 November 2026 (Australia/Melbourne) that
machine-specific absolute filesystem paths be removed from tracked content in
this repository, including the previously frozen contract references, and
then that they be removed from Git history as well. The instruction covers
path redaction only. It does not authorise a change to contract behaviour or
to unrelated accepted wording.

## What acceptance still refers to

Nathan's acceptance of 15 November 2026 applies to the exact bytes recorded by
[acceptance-2026-11-15.md](acceptance-2026-11-15.md). Those bytes are
identified by [candidate.sha256](candidate.sha256), which is kept unchanged and
still hashes to
`c162c9850ca506fd839ce36b2b1a8172f064516b0f229dd34a5678b366b02b9d`.

The accepted bytes are no longer in this repository's published history. They
are held in private recovery material outside any published ref: a Git bundle
of the pre-redaction history with SHA-256
`89d5307a258a7168fafbf37c76e96dfa47b7c7a5bf1cde294b02320e3e464623`. In that
bundle the accepted source commit is
`5693651d19c6fba2430c904688e583266dbe58a0` and the acceptance commit is
`d6823e21992ac13e46bb53f6201863d8a1869075`.

The redacted bytes do not match the accepted manifest and are not claimed to.
Two of its 20 files differ, so
`shasum -a 256 -c references/contract-3/candidate.sha256` reports
`requirement-map.md` and `review.md` as failed in every published commit whose
`candidate.sha256` is the accepted manifest. Two earlier candidate manifests
in pre-acceptance history no longer verify for the same reason. That result
is expected and is the honest record of the difference.

## Redacted revision identity

[redacted-2026-11-16.sha256](redacted-2026-11-16.sha256) lists the same 20
paths in the same order with the hashes of the redacted revision. Its SHA-256 is
`41b77e7e3a7af8499c589872e8a1b19ef726e79f9a39ea8c69b793b2ef595595`. Verify
the current tree from the skill root:

```sh
shasum -a 256 -c references/contract-3/redacted-2026-11-16.sha256
```

Eighteen entries are identical to the accepted manifest. Two changed:

| File                 | Accepted SHA-256                                                   | Redacted SHA-256                                                   |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `requirement-map.md` | `99f0eae287481d5c25cbe7e6e811e8e9db2232db35653527a9e7f1a635771989` | `210193ee6c0c0698d1706b0adfeb335b33ef0af3749f1f4b85a81ebc4d0a832d` |
| `review.md`          | `7a99c5ce7da81a6bff5b099945eec1ea25bfdf777425391e62d07cfd718395f9` | `ac223cf3f7d2e1a23d8c400720d145ed8444957e7b3490c443f69362c7f44f93` |

## Exact delta

Fifteen exact text replacements were applied to every historical version of
the files below. No other byte changed, and commit messages, authors, dates
and parent links are unchanged.

| File                                                       | Place                                                        | Before                                                                    | After                                                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `requirement-map.md`                                       | "Source locations and evidence limits", seven source bullets | Markdown links whose targets were absolute paths on the authoring machine | Plain text naming the `my-second-brain-playground` repository and a relative path, or the private execution evidence set and a relative path |
| `review.md`                                                | Final review readback paragraph                              | Absolute path to a private evidence directory                             | Private execution evidence set `agent-engineering-contract3-20261115`, `consolidation-review/`                                               |
| `review.md`                                                | TypeScript corrections paragraph                             | Absolute path to a private evidence directory                             | Private execution evidence set `agent-engineering-contract3-20261115`, `typescript-corrections/`                                             |
| `acceptance-2026-11-15.md` (outside both manifests)        | Reviewed candidate paragraph                                 | Absolute path to a receipt file                                           | Same evidence set, `typescript-corrections/final-receipt.json`                                                                               |
| `navigation-proposal.md` (versions before acceptance only) | Two table cells                                              | Markdown links whose targets were absolute paths                          | Plain text naming the repository and a relative path                                                                                         |
| `.cli-design-template.json`, `AGENTS.md`, `README.md`      | Stamped source-packet value                                  | Absolute path to the source packet                                        | The portable URL the template generator stamps at template revision `7cb52b781850403120f2f0c2aa7e31c1e3fec1ec`                               |

The former links pointed at files outside this repository and resolved only on
one machine. They are now plain references, so no link was invented. No raw
evidence was copied into the repository.

## Commit identities

Removing the paths from history changed the identity of every commit from the
first one that contained a path. Documents and commit messages written before
16 November 2026 cite the original identities. They are kept as written and
resolve through this table. Original identities are kept privately in the
recovery bundle; they no longer appear in this repository's published
branches.

| Original commit                            | Published commit                           |
| ------------------------------------------ | ------------------------------------------ |
| `14fd696647883d8d32267b8e7a2f12dfbeb20b45` | unchanged                                  |
| `bbf6a66195b817adf37a42955ae32d398de656b9` | unchanged                                  |
| `4b987010c8caa072752a86ca3d74a6c9c8eaa15a` | unchanged                                  |
| `756dca98f905af2a3618d8aecda9d265ce12227e` | unchanged                                  |
| `c34475b4449a729dfecad8bde19c1ca5a7487b77` | unchanged                                  |
| `cff1bd64e670b3560a7cf047a39282d8b0d62a6e` | unchanged                                  |
| `da4256dc438f53a08f94e141f76ee154053e7556` | unchanged                                  |
| `fc778528014ae24687906a972a43c6a6a80db688` | `f29a0507c661dde0c6eea581cd88e439879b434f` |
| `d30979cb22697b71a9aee149effa3c7e90732107` | `4ed7f3e4d9fada5f35b33ca09e9a415c8223bcaa` |
| `907d7d630aa022eebcb0d11c32c94bb144737f7e` | `bbb916026686ce739fb2b70573b74ce8c95e2414` |
| `379f7f6e1b4a5e4e3c06f16f18afd021d436cebf` | `cb6305c77d3eb3049381a3d212748929dbe6377b` |
| `65fb3c5cb74aa6184a58e805dd0253d252b2425a` | `de7b25372097f3da57a6475702ddec97dbf325a9` |
| `8e69ea36823489e54a4a508caf06620f579d079b` | `553eb44c3a22861774a5ed11c1dad0eed3377a87` |
| `921faf0444500395b84bacfd697f8116d43b8890` | `a49f540fb4352dda41c42fb677d990a9c3f8675b` |
| `e19b74556a149142cac99ec126b08085e47cef9e` | `0eab99909483f75a547f42d2a67366ba6b6297bf` |
| `3879157397f6f14d102a82013cf3ec14c37bc0e5` | `d9b3117de3c62a4070dc9fcced6fcc7d5fb8dd42` |
| `9d1ecf1b79974cfa7c74eb7a530546ef9cf1a50d` | `54bcc7efdf81369313ea2f4d50cfecc3cad52c6b` |
| `0602d8bc949d88c685c9bfd32e3df2d1e83f5063` | `e052e219fd1ff935eda72bc423a397837b40f239` |
| `de164f1f7994894420707a3dd5cd7f90c14b5011` | `b1c6aea6872af127eabee23370a8d70261527e6f` |
| `5693651d19c6fba2430c904688e583266dbe58a0` | `648f93275717d5b031dd4bb4fc67f80cd9940383` |
| `d6823e21992ac13e46bb53f6201863d8a1869075` | `f757166db9564767b3d0b9cd29809d375bf57925` |
| `0780f1af0c50a0f07442056f9fe7d69310c72c63` | `970f2d73dd670d5e358988d9cab84b7e31e323d0` |
| `719c89e0cd9e35629d6fb3ee918ed729166b7b57` | `83ac9b4186841c89914281c097ed524fd62a5919` |
| `29059ee9dad834bde9ce6bd00e4765bbc39766bd` | `6d61dd5adcdb2a0b92ddf7c80d7de922828025b2` |
| `dce075c17b0d9533ab4f47dbabfdc65ff1ea23b7` | `e2de6e4794b4326cd33fe48846258faf40ba32f7` |
| `c99fed16b64eae5c0801aac8f748fcbbaf12790f` | `dd43059c68a40dc77c5e1019848cd325673af86b` |

## Limits

- This record cannot prove that a hosting provider has erased the earlier
  objects. Rewriting branches changes what the refs reach, not what a provider
  may still hold.
- Diagnostics location text such as `~/.local/state/<cli>/diagnostics` is a
  contract rule, not a machine path, and is unchanged.
- The independent expectation files under `tests/contract3/` cite the accepted
  manifest as their source identity. That remains correct: the expectations
  were derived from the accepted bytes and no rule changed.

## Independent review

Both the redaction and the history rewrite were reviewed by a reviewer who did
not make the change. The verdicts are kept with the private execution evidence
set `agent-engineering-contract3-20261115`, under `foundation-packet/redaction-review/`
and `foundation-packet/history-rewrite-review/`, and are summarised in the pull
request rather than here, so that this file does not describe its own review.
