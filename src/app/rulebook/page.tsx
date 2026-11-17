import type { Metadata } from 'next';
import { Rulebook } from '@/components/rulebook/Rulebook';

export const metadata: Metadata = {
  title: 'Rulebook',
  description: 'Every fault NAADI can name: its spectrum, its sound, the channels it punches, the evidence that moves it and what to do.',
};

export default function RulebookPage() {
  return <Rulebook />;
}
