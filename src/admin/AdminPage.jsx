import SalesReport from './SalesReport.jsx';
import MenuPhotos from './MenuPhotos.jsx';
import { useEffect, useState } from 'react';

export default function AdminPage() {
  const [tab, setTab] = useState('sales');
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/session', { signal: controller.signal, cache: 'no-store', redirect: 'error' })
      .then(async response => {
        if (!response.ok) throw new Error('Please sign in again to access your dashboard.');
        const data = await response.json();
        if (data.role !== 'admin' || !data.email) throw new Error('Unable to verify your admin session.');
        setSession(data);
      }).catch(error => { if (error.name !== 'AbortError') setError(error.message); });
    return () => controller.abort();
  }, []);
  return <main className="min-h-screen bg-cream px-5 py-8 text-ink sm:px-10">
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <a href="/" className="font-display text-3xl">Swirl Girl</a>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="rounded-full bg-white px-3 py-1 text-inkMuted">Admin</span>
          {session && <a className="underline underline-offset-4" href="/cdn-cgi/access/logout">Sign out</a>}
        </div>
      </header>
      <section className="py-8 sm:py-10">
        <p className="mb-3 text-sm uppercase tracking-widest text-brandBrown">Your workspace</p>
        <h1 className="font-display text-4xl sm:text-5xl">Welcome back.</h1>
        {!session && !error && <p className="mt-6 text-inkMuted" role="status">Checking your sign-in…</p>}
        {error && <div className="mt-6" role="alert"><p>{error}</p><a className="mt-4 inline-block underline" href="/admin">Sign in again</a></div>}
        {session && <>
          <p className="mt-4 break-words text-inkMuted">Signed in as {session.email}</p>
          <nav aria-label="Admin tools" className="mt-6 flex gap-3">
            {session.reportsEnabled && <button className={`rounded-full px-5 py-2 ${tab === 'sales' ? 'bg-brandBrown text-white' : 'border border-line'}`} aria-pressed={tab === 'sales'} onClick={() => setTab('sales')}>Sales & customers</button>}
            <button className={`rounded-full px-5 py-2 ${tab === 'menu' ? 'bg-brandBrown text-white' : 'border border-line'}`} aria-pressed={tab === 'menu'} onClick={() => setTab('menu')}>Menu & photos</button>
          </nav>
          {session.reportsEnabled && <div hidden={tab !== 'sales'}><SalesReport environment={session.environment} /></div>}
          <div hidden={tab !== 'menu'}><MenuPhotos environment={session.environment} /></div>
        </>}
      </section>
      <a href="/" className="text-sm underline underline-offset-4">View storefront</a>
    </div>
  </main>;
}
