/**
 * Defines the open source persona categories and their ranking priority.
 * Priority 1 is the highest rank.
 */
const personaCategories = [
  {
    key: 'reviewedPrCount',
    title: 'Community Mentor',
    desc: 'Expert advocate for code quality and peer development. Code review and technical guidance ensure high standards across the community.',
    priority: 1,
  },
  {
    key: 'prCount',
    title: 'Core Contributor',
    desc: 'Main driver of project development. Responsible for moving features from concept to production through robust code and resolving complex bugs to ensure software stability.',
    priority: 2,
  },
  {
    key: 'issueCount',
    title: 'Project Architect',
    desc: 'Strategic problem-solver focused on technical discovery. Skilled at identifying critical system issues and defining feature planning that shapes the long-term technical roadmap.',
    priority: 3,
  },
  {
    key: 'coAuthoredPrCount',
    title: 'Collaborative Partner',
    desc: 'Focused on shared project success. Pair programming and co-authoring code delivers high-impact value through collective development effort.',
    priority: 4,
  },
  {
    key: 'collaborationCount',
    title: 'Ecosystem Partner',
    desc: 'Community builder focused on technical discussion and engagement. Facilitates collaboration through project discussions to ensure the open source ecosystem remains vibrant and interconnected.',
    priority: 5,
  },
];

const DEFAULT_PERSONA = {
  title: 'Open Source Contributor',
  desc: 'Active member of the global open source community.',
};

module.exports = {
  personaCategories,
  DEFAULT_PERSONA,
};
