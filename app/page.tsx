import { Sparkles } from 'lucide-react';

import { Waves } from '@/components/waves';
import { WaitlistForm } from '@/components/waitlist-form';

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-neutral-50 dark:bg-background">
      <Waves />
      <div className="relative z-10 flex flex-1 flex-col">
        <main className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="flex flex-col items-center space-y-6 text-center">
            <div className="space-y-4 max-w-xl">
              <h1 className="text-4xl font-normal tracking-tighter leading-none md:text-5xl mb-2">
                Imagine your dream store
              </h1>
              <p className="text-xl text-muted-foreground">
                Now say it - Your Next Store will build itself
              </p>
            </div>

            <div className="w-full max-w-md pt-4">
              <WaitlistForm />
            </div>

            <p className="text-sm text-muted-foreground max-w-md">
              Be the first to create AI-powered e-commerce stores.
              Join the waitlist for early access.
            </p>
          </div>
        </main>

        <footer className="w-full py-6">
          <div className="container flex flex-col items-center justify-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <span>new.store</span>
              <span>&middot;</span>
              <span>&copy; {new Date().getFullYear()} YNS</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
