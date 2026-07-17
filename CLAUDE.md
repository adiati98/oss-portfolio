# Working conventions for this repo

## Never commit without explicit permission

Do not run `git commit` (or `git push`) for any change in this repo unless
the user explicitly says to commit *that specific change* — "commit this",
"go ahead", "commit and PR this". Finish the work, show the diff, and stop.

This applies even when:
- the fix is fully tested and root-caused
- the user asked you to commit something *else* earlier in the same message
  or session — that authorization does not carry forward to later work,
  including fixes requested in the same breath (e.g. "First, commit X. Then,
  fix Y and Z." authorizes committing X only, not Y or Z once done)
- it feels like the obvious next step

Ask before staging or committing every time, per-change, no matter how
clearly the prior instruction seemed to imply it.

## Never link to another repo's issues/PRs in committed content

Do not write a bare `owner/repo#number` or a full GitHub URL to another
repository's issue or pull request inside anything that gets committed,
pushed, or posted — commit messages, PR descriptions/titles, issue bodies,
issue comments. GitHub auto-links that pattern and creates a permanent
cross-reference on the *target* repo's timeline that cannot be undone by
editing, deleting, or force-pushing. If a number must be mentioned, break
the autolink (backtick it as code, or rephrase to avoid the exact
`owner/repo#number` shape).
