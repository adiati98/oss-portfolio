/**
 * Escaping for external strings (PR/article titles, repo names) interpolated
 * into generated Markdown. Without it, a `|` breaks a GFM table row and an
 * unescaped `[`/`]` prematurely closes a `[text](url)` link span.
 */

/** Safe for a table cell or plain bullet text: collapses embedded newlines
 * (which would otherwise split the row/bullet) and escapes `|`. */
function mdEscapeCell(str) {
  return String(str || '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|');
}

/** Safe as markdown link text (`[...](url)`): mdEscapeCell, plus guards
 * `[`/`]` so the text can't close the link span early. */
function mdEscapeLinkText(str) {
  return mdEscapeCell(str).replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

module.exports = { mdEscapeCell, mdEscapeLinkText };
