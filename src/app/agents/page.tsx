import type { Metadata } from 'next';
import { AgentConsole } from '@/components/agents/AgentConsole';

export const metadata: Metadata = {
  title: 'Agents',
  description: 'Watch NAADI’s agents call deterministic tools, re-plan when the facts change, and hold every outward action for the owner.',
};

export default function AgentsPage() {
  return <AgentConsole />;
}
