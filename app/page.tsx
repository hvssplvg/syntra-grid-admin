import { redirect } from 'next/navigation';

// proxy.ts's matcher now includes '/', so auth.middleware() already
// redirected an unauthenticated visitor to /login before this ever
// renders — getSession() must not be called here (it refreshes the
// session cookie as a side effect, which Next.js only allows from a
// Server Action or Route Handler, never a plain Server Component).
export default function HomePage() {
  redirect('/dashboard');
}