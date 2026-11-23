// The standalone agents a visitor can buy one by one (the 18 of `agentOffers` in ai-teams.ts without the Director), as a
// leaf module: the builder link decoder needs the ids and must not import ai-teams (which imports the builder).
// `tests/builder-agent.test.mjs` checks this list against `agentOffers`.
export const standaloneAgentIds = [
  'trend-scout',
  'content-maker',
  'publisher',
  'analyst',
  'seo',
  'lead-handler',
  'prospector',
  'presales',
  'referral',
  'support',
  'monitoring',
  'billing',
  'onboarding',
  'project-manager',
  'reviewer-qa',
  'deployer',
  'documents',
  'knowledge-base',
] as const
export type StandaloneAgentId = (typeof standaloneAgentIds)[number]

// The most asked-for agents, shown first on the home page (owner picks later; fixed for now).
export const popularAgentIds = ['lead-handler', 'support', 'content-maker', 'analyst', 'onboarding', 'documents'] as const satisfies readonly StandaloneAgentId[]

// Where an agent can work (equal channels, none is the default), what it can be connected to, how much work it gets.
export const agentChannelIds = ['telegram', 'whatsapp', 'web', 'voice', 'email'] as const
export type AgentChannelId = (typeof agentChannelIds)[number]
export const agentConnectIds = ['crm', 'calendar', 'site', 'payments', 'sheets'] as const
export type AgentConnectId = (typeof agentConnectIds)[number]
export const agentVolumeIds = ['s', 'm', 'l', 'xl'] as const
export type AgentVolumeId = (typeof agentVolumeIds)[number]
// Paid options of the agent path: importing the client's knowledge and training the team.
export const agentAddonIds = ['knowledge', 'training'] as const
export type AgentAddonId = (typeof agentAddonIds)[number]
