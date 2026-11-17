import { redirect } from 'next/navigation';

// The overview page arrives in the next build step; until then the shed floor is home.
export default function Home() {
  redirect('/floor');
}
