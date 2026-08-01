import { auth } from '@/lib/auth/server';

export default auth.middleware({
  loginUrl: '/login',
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/clients/:path*',
    '/projects/:path*',
    '/monitoring/:path*',
    '/deployments/:path*',
    '/support/:path*',
    '/finance/:path*',
    '/team/:path*',
    '/settings/:path*',
  ],
};