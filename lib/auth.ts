import 'server-only';
import { cookies } from 'next/headers';
import { supabaseRequest } from './supabase';
export const cookieName =
  process.env.NODE_ENV === 'production' ? '__Host-merveille-session' : 'merveille-session';
export function adminConfigured() {
  return Boolean(
    process.env.ADMIN_USER_ID && process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY,
  );
}
export async function isAdmin(): Promise<boolean> {
  if (!adminConfigured()) return false;
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return false;
  try {
    const user = await supabaseRequest<{ id: string; email_confirmed_at?: string }>(
      '/auth/v1/user',
      {},
      token,
      true,
    );
    return user.id === process.env.ADMIN_USER_ID && Boolean(user.email_confirmed_at);
  } catch {
    return false;
  }
}
