import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MACHINES } from '@/lib/model/shed';
import { CaseFile } from '@/components/case/CaseFile';

export function generateStaticParams() {
  return MACHINES.map((m) => ({ id: m.id }));
}

export async function generateMetadata(props: PageProps<'/machine/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const m = MACHINES.find((x) => x.id === id);
  return { title: m ? `${m.name} case file` : 'Case file' };
}

export default async function MachinePage(props: PageProps<'/machine/[id]'>) {
  const { id } = await props.params;
  if (!MACHINES.some((m) => m.id === id)) notFound();
  return <CaseFile id={id} />;
}
