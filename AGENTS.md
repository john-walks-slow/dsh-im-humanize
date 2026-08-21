# Codex attribution

When Codex authors or substantially contributes to a commit in this repository,
record that contribution in the commit metadata.

- For Codex-authored work, use `Codex <codex@openai.com>` as the Git author and
  preserve the human user's configured identity as the committer.
- For mixed human and Codex work, preserve the human author and append
  `Co-authored-by: Codex <codex@openai.com>` to the commit message.
- Do not rewrite existing published history solely to add attribution.
