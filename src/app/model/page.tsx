import type { Metadata } from 'next';
import { ModelCard } from '@/components/model/ModelCard';

export const metadata: Metadata = {
  title: 'Model card',
  description: 'How far to trust NAADI’s numbers: a simulation study of change detection, forecast calibration, false alarms and rupees saved, run in your browser.',
};

export default function ModelPage() {
  return <ModelCard />;
}
