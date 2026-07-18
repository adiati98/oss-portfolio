/**
 * Skills & tools shown on the Journey page (design blueprint §04).
 *
 * No proficiency bars or self-graded levels — the portfolio's own pages are
 * the evidence. `expertise` entries are the named competency areas (display
 * type); `tools` and `skills` each render as their own flat chip row (only
 * when non-empty); entries listed in `highlight` get the accented chip
 * style in either row (keep it to the two or three most identity-defining
 * items).
 */
module.exports = {
  expertise: [
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
  tools: ['Git', 'GitHub', 'Docusaurus', 'Sphinx', 'Markdown', 'MDX', 'RST'],
  skills: ['JavaScript', 'React'],
  highlight: ['Git', 'GitHub'],
};
