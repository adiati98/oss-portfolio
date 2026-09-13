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
      title: 'Technical writing and content strategy',
      blurb: 'Writing blogs, updating user and developer docs, and editing AI-drafted PRs.',
    },
    {
      title: 'Docs architecture',
      blurb: 'Building style guides and managing multi-version documentation.',
    },
    {
      title: 'Docs review & contributor mentoring',
      blurb: 'Reviewing PRs and guiding first-time contributors all the way to merged work.',
    },
    {
      title: 'Docs leadership',
      blurb: 'Owning documentation standards, repositories, and decisions.',
    },
  ],
  tools: ['Git', 'GitHub', 'Docusaurus', 'Sphinx', 'Vale', 'Markdown', 'MDX', 'RST'],
  skills: ['JavaScript', 'React'],
  highlight: ['Git', 'GitHub'],
};
