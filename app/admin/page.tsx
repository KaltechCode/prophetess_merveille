import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import AdminDashboard from './dashboard';
export const dynamic = 'force-dynamic';
export default async function Admin() {
  if (!(await isAdmin())) redirect('/admin/login');
  return (
    <>
      <div className="admin-session">
        <form action="/api/auth/logout" method="post">
          <button type="submit">Sign out</button>
        </form>
      </div>
      <AdminDashboard />
    </>
  );
}
