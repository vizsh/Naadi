import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ALL_MACHINE_IDS, SHEDS, SHED_IDS } from '@/lib/model/sheds';
import { CaseFile } from '@/components/case/CaseFile';

// every machine of every shed type has a page; the active shed decides what it shows
export function generateStaticParams() {
  return ALL_MACHINE_IDS.map((id) => ({ id }));
}

const nameOf = (id: string) => SHED_IDS.map((s) => SHEDS[s].machines.find((m) => m.id === id)).find(Boolean)?.name;

export async function generateMetadata(props: PageProps<'/machine/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const name = nameOf(id);
  return { title: name ? `${name} case file` : 'Case file' };
}

export default async function MachinePage(props: PageProps<'/machine/[id]'>) {
  const { id } = await props.params;
  if (!ALL_MACHINE_IDS.includes(id)) notFound();
  return <CaseFile id={id} />;
}
