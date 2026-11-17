import type { Metadata } from 'next';
import { LiveLab } from '@/components/lab/LiveLab';

export const metadata: Metadata = {
  title: 'Live Lab',
  description: 'Your phone or laptop microphone as a machine sensor: learn normal in 20 seconds, then watch cards punch live.',
};

export default function LabPage() {
  return <LiveLab />;
}
