/**
 * Skills & tools shown on the Journey page (design blueprint §04).
 *
 * No proficiency bars or self-graded levels — the portfolio's own pages are
 * the evidence. `craft` entries are the named competency areas (display
 * type); `tools` render as a flat chip row; entries listed in `highlight`
 * get the accented chip style (keep it to the two or three most
 * identity-defining tools).
 */
module.exports = {
  craft: [
    {
      title: 'Technical writing & docs architecture',
      blurb:
        'Information architecture, style guides, and versioned docs programs for user- and developer-facing documentation.',
    },
    {
      title: 'Code review & contributor mentoring',
      blurb: 'Reviewing docs and code PRs, and guiding first-time contributors to merged work.',
    },
    {
      title: 'Docs leadership',
      blurb:
        'Leading documentation teams and programs across Mautic, Virtual Coffee, and Open Source Communities.',
    },
  ],
  tools: ['Git', 'GitHub', 'Docusaurus', 'Sphinx', 'Markdown', 'MDX', 'RST', 'JavaScript', 'React'],
  highlight: ['Git', 'GitHub'],
};
