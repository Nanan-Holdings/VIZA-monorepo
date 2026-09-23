# Marketing News Pipeline

Scope: `lib/marketing/news-pipeline/**`.

This module scans public RSS and Atom feeds, ranks candidate headlines through an
injected JSON completion function, resolves readable publisher articles, and
builds a source-bounded brief for the existing marketing draft generator.

- Keep this module free of database, credentials, cron, and publishing writes.
- The caller owns VIZA feed configuration, run persistence, provider selection,
  draft validation, and approval.
- Do not draft from a headline alone. Require at least `MIN_ARTICLE_CHARS` of
  readable publisher text and preserve the article URL in the draft brief.
- News articles are not official visa guidance. Keep the prompt-injection and
  changing-requirement cautions in the grounded brief.
