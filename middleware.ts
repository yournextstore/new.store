import NextAuth from 'next-auth';

import { authConfig } from '@/app/(auth)/auth.config';

// export default NextAuth(authConfig).auth;

// The above line is commented out to disable auth during development
// Instead, we export a minimal middleware function that does nothing.
export default function middleware() {}

// export const config = {
//   matcher: ['/', '/:id', '/api/:path*', '/login', '/register'],
// };
