'use client';

import {
  AuthUIProvider,
  type AuthUIProviderProps,
} from '@daveyplate/better-auth-ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';
import { authClient } from './auth-client';
import Link from 'next/link';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();

  return (
    <Suspense>
      <AuthUIProvider
        authClient={authClient}
        navigate={router.push}
        replace={router.replace}
        onSessionChange={() => {
          // Clear router cache (protected routes)
          router.refresh();
        }}
        Link={Link as AuthUIProviderProps['Link']}
        providers={['google']}
        basePath={process.env.NEXT_PUBLIC_ROOT_URL}
        viewPaths={{
          signIn: 'login',
          signUp: 'signup',

          callback: 'auth/callback',
          forgotPassword: 'auth/forgot-password',
          magicLink: 'auth/magic-link',
          resetPassword: 'auth/reset-password',
          settings: 'auth/settings',
          signOut: 'auth/sign-out',
        }}
        redirectTo="/"
      >
        {children}
      </AuthUIProvider>
    </Suspense>
  );
};
