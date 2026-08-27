'use client';

import QRCode from 'qrcode';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Status = 'New' | 'Approved' | 'Played' | 'Declined';
type SongRequest = {
  id: string;
  song_title: string;
  artist: string;
  note: string | null;
  status: Status;
  created_at: string;
  updated_at: string;
};
type Settings = {
  eventName: string;
  requestLimit: number;
  closingTime: string | null;
  guestToken: string;
  pinVersion: number;
};
type AdminData = { settings: Settings; requests: SongRequest[] };

const statusOrder: Status[] = ['New', 'Approved', 'Played', 'Declined'];

function dateTimeLocal(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | Status>('All');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'status'>('newest');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (quiet = false) => {
    try {
      const response = await fetch('/api/admin/data', { cache: 'no-store' });
      if (response.status === 401) {
        setData(null);
        return;
      }
      if (!response.ok) throw new Error('The dashboard could not refresh.');
      setData(await response.json());
    } catch (caught) {
      if (!quiet) setMessage(caught instanceof Error ? caught.message : 'The dashboard could not refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => {
    if (!data) return;
    const interval = window.setInterval(() => void loadData(true), 3_000);
    return () => window.clearInterval(interval);
  }, [data, loadData]);

  const guestUrl = typeof window !== 'undefined' && data
    ? `${window.location.origin}/e/${data.settings.guestToken}`
    : '';

  useEffect(() => {
    if (!guestUrl) return;
    QRCode.toDataURL(guestUrl, { width: 260, margin: 2, color: { dark: '#130d1a', light: '#efd28a' } })
      .then(setQrCode)
      .catch(() => setQrCode(''));
  }, [guestUrl]);

  const visibleRequests = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    const list = data.requests.filter((request) => {
      const matchesFilter = filter === 'All' || request.status === filter;
      const haystack = `${request.song_title} ${request.artist} ${request.note ?? ''}`.toLowerCase();
      return matchesFilter && (!term || haystack.includes(term));
    });
    return [...list].sort((left, right) => {
      if (sort === 'oldest') return left.created_at.localeCompare(right.created_at);
      if (sort === 'status') return statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status) || right.created_at.localeCompare(left.created_at);
      return right.created_at.localeCompare(left.created_at);
    });
  }, [data, filter, search, sort]);

  async function login(loginEvent: FormEvent) {
    loginEvent.preventDefault();
    setMessage('');
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(result.error ?? 'Unable to unlock. Please try again.');
      setPin('');
      await loadData();
    } catch {
      setMessage('Unable to unlock. Check your connection and try again.');
    }
  }

  async function logout() {
    await fetch('/api/admin/session', { method: 'DELETE' });
    setData(null);
  }

  async function updateStatus(id: string, status: Status) {
    const previous = data;
    setData((current) => current ? {
      ...current,
      requests: current.requests.map((request) => request.id === id ? { ...request, status } : request),
    } : current);
    const response = await fetch(`/api/admin/requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      setData(previous);
      setMessage('That status change did not save.');
    }
  }

  async function saveSettings(settingsEvent: FormEvent<HTMLFormElement>) {
    settingsEvent.preventDefault();
    setSaving(true);
    setMessage('');
    const values = Object.fromEntries(new FormData(settingsEvent.currentTarget).entries());
    const closingValue = String(values.closingTime ?? '');
    const payload = {
      ...values,
      requestLimit: Number(values.requestLimit),
      closingTime: closingValue ? new Date(closingValue).toISOString() : '',
    };
    const response = await fetch('/api/admin/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(result.error ?? 'Settings did not save.');
    setMessage('Event settings saved.');
    await loadData(true);
  }

  async function changePin(pinEvent: FormEvent<HTMLFormElement>) {
    pinEvent.preventDefault();
    const form = pinEvent.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    if (values.newPin !== values.confirmPin) return setMessage('The new PIN entries do not match.');
    const response = await fetch('/api/admin/pin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? 'PIN did not change.');
    form.reset();
    setData(null);
    setSettingsOpen(false);
    setMessage('PIN changed. Sign in again with the new PIN.');
  }

  async function copyGuestLink() {
    await navigator.clipboard.writeText(guestUrl);
    setMessage('Private guest link copied.');
  }

  if (loading) return <main className="admin-shell"><div className="admin-loading"><p className="eyebrow">Opening the control room…</p></div></main>;

  if (!data) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="monogram"><span>DJ</span></div>
          <p className="eyebrow">Stage &amp; screen control room</p>
          <h1>DJ Request List</h1>
          <p className="login-copy">Enter the dashboard PIN to manage tonight&apos;s requests.</p>
          <form onSubmit={login} className="pin-form">
            <label><span>Admin PIN</span><input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" type="password" autoComplete="current-password" required minLength={4} /></label>
            {message && <p className="form-error" role="alert">{message}</p>}
            <button type="submit">Unlock dashboard <span aria-hidden="true">→</span></button>
          </form>
        </section>
      </main>
    );
  }

  const totals = Object.fromEntries(statusOrder.map((status) => [status, data.requests.filter((request) => request.status === status).length])) as Record<Status, number>;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a href={guestUrl} className="back-link">← Guest list</a>
        <span className="header-mark">DJ</span>
        <button className="text-button" onClick={logout}>Lock dashboard</button>
      </header>

      <section className="admin-hero">
        <div><p className="eyebrow">Stage &amp; screen control room</p><h1>{data.settings.eventName}</h1><p>Requests refresh automatically every few seconds.</p></div>
        <div className="hero-actions"><a href={guestUrl} className="outline-button">Preview guest list</a><button className="outline-button" onClick={() => setSettingsOpen((open) => !open)}>Event settings</button></div>
      </section>

      <section className="stat-grid" aria-label="Request totals">
        {statusOrder.map((status) => <button key={status} className={`stat-card ${filter === status ? 'selected' : ''}`} onClick={() => setFilter(filter === status ? 'All' : status)}><span>{status}</span><strong>{totals[status]}</strong><small>{status === 'New' ? 'awaiting review' : `${status.toLowerCase()} requests`}</small></button>)}
      </section>

      {settingsOpen && (
        <section className="settings-panel">
          <div className="panel-heading"><div><p className="eyebrow">Audience experience</p><h2>Event settings</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button></div>
          <div className="settings-layout">
            <form className="settings-form" onSubmit={saveSettings}>
              <label><span>Event name</span><input name="eventName" defaultValue={data.settings.eventName} required maxLength={100} /></label>
              <div className="form-grid"><label><span>Requests per device</span><input name="requestLimit" type="number" min="1" max="25" defaultValue={data.settings.requestLimit} required /></label><label><span>Request line closes</span><input name="closingTime" type="datetime-local" defaultValue={dateTimeLocal(data.settings.closingTime)} /></label></div>
              <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save event settings'}</button>
            </form>
            <aside className="share-card">
              <p className="eyebrow">Private guest entrance</p>
              <h3>Scan to request</h3>
              {qrCode && <img src={qrCode} alt="QR code for the private guest request page" />}
              <div className="guest-url">{guestUrl}</div>
              <button type="button" onClick={copyGuestLink}>Copy private guest link</button>
            </aside>
          </div>
          <form className="change-pin" onSubmit={changePin}>
            <div><p className="eyebrow">Dashboard security</p><h3>Change admin PIN</h3></div>
            <label><span>Current PIN</span><input name="currentPin" type="password" inputMode="numeric" pattern="[0-9]{4,12}" required /></label>
            <label><span>New PIN</span><input name="newPin" type="password" inputMode="numeric" pattern="[0-9]{4,12}" required /></label>
            <label><span>Confirm new PIN</span><input name="confirmPin" type="password" inputMode="numeric" pattern="[0-9]{4,12}" required /></label>
            <button type="submit" className="outline-button">Change PIN</button>
          </form>
        </section>
      )}

      <section className="requests-panel">
        <div className="panel-heading"><div><p className="eyebrow">Tonight&apos;s queue</p><h2>Song requests</h2></div><span className="live-pill"><i /> Live</span></div>
        <div className="request-tools">
          <label className="search-box"><span className="sr-only">Search requests</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search song, artist, or reason" /></label>
          <select value={filter} onChange={(event) => setFilter(event.target.value as 'All' | Status)} aria-label="Filter requests"><option>All</option>{statusOrder.map((status) => <option key={status}>{status}</option>)}</select>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort requests"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="status">By status</option></select>
        </div>
        {message && <p className="dashboard-message" role="status">{message}</p>}
        <div className="request-list">
          {visibleRequests.length === 0 ? (
            <div className="empty-list"><span>♪</span><h3>No requests in this reel yet.</h3><p>New guest requests will appear here automatically.</p></div>
          ) : visibleRequests.map((request) => (
            <article className="request-row" key={request.id}>
              <div className={`status-dot status-${request.status.toLowerCase()}`} aria-hidden="true" />
              <div className="song-info"><h3>{request.song_title}</h3><p>{request.artist}</p>{request.note && <blockquote>“{request.note}”</blockquote>}</div>
              <div className="request-time"><time dateTime={request.created_at}>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(request.created_at))}</time></div>
              <label className={`status-select status-bg-${request.status.toLowerCase()}`}><span className="sr-only">Status for {request.song_title}</span><select value={request.status} onChange={(event) => updateStatus(request.id, event.target.value as Status)}>{statusOrder.map((status) => <option key={status}>{status}</option>)}</select></label>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
