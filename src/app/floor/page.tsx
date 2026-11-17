import type { Metadata } from 'next';
import { FloorView } from '@/components/floor/FloorView';

export const metadata: Metadata = {
  title: 'Shed floor',
  description: 'Nine machines, fourteen days of six-hour punched cards, a 3D twin of the shed and the next decision priced in rupees.',
};

export default function FloorPage() {
  return <FloorView />;
}
