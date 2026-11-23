import { agentOffer, type AgentId, type AiTeamId } from './ai-teams'

// The department of the first agent of a build (the questions follow it); none: the company one.
export const deptOfAgents = (build: { agents?: readonly string[] }): AiTeamId => {
  const id = build.agents?.[0]
  return id ? agentOffer(id as AgentId).dept : 'company'
}
