import { auth } from '@/lib/auth';
import { ChatInner } from './chat';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/login');
  }

  return <ChatInner user={session.user} />;
}
