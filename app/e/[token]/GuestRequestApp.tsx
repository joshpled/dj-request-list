'use client';

import { FormEvent, useEffect, useState } from 'react';

type EventInfo = {
  eventName: string;
  welcomeMessage: string;
  requestLimit: number;
  closingTime: string | null;
  requestCount: number;
  isOpen: boolean;
};

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const songCatalog = [
  ['September', 'Earth, Wind & Fire'],
  ['Dancing Queen', 'ABBA'],
  ['I Wanna Dance with Somebody', 'Whitney Houston'],
  ['Don’t Stop Me Now', 'Queen'],
  ['Levitating', 'Dua Lipa'],
  ['Espresso', 'Sabrina Carpenter'],
  ['Uptown Funk', 'Mark Ronson feat. Bruno Mars'],
  ['Crazy in Love', 'Beyoncé feat. Jay-Z'],
  ['Yeah!', 'Usher feat. Lil Jon & Ludacris'],
  ['Mr. Brightside', 'The Killers'],
  ['Shut Up and Dance', 'WALK THE MOON'],
  ['24K Magic', 'Bruno Mars'],
  ['About Damn Time', 'Lizzo'],
  ['Ain’t No Mountain High Enough', 'Marvin Gaye & Tammi Terrell'],
  ['At Last', 'Etta James'],
  ['Best of My Love', 'The Emotions'],
  ['Can’t Stop the Feeling!', 'Justin Timberlake'],
  ['Cupid Shuffle', 'Cupid'],
  ['Dance the Night', 'Dua Lipa'],
  ['Don’t Leave Me This Way', 'Thelma Houston'],
  ['Everybody (Backstreet’s Back)', 'Backstreet Boys'],
  ['Good as Hell', 'Lizzo'],
  ['Good Luck, Babe!', 'Chappell Roan'],
  ['Hey Ya!', 'Outkast'],
  ['Higher Love', 'Kygo & Whitney Houston'],
  ['Into the Groove', 'Madonna'],
  ['Just Dance', 'Lady Gaga feat. Colby O’Donis'],
  ['Love on Top', 'Beyoncé'],
  ['Murder on the Dancefloor', 'Sophie Ellis-Bextor'],
  ['Only Girl (In the World)', 'Rihanna'],
  ['Pink Pony Club', 'Chappell Roan'],
  ['Signed, Sealed, Delivered', 'Stevie Wonder'],
  ['Superstition', 'Stevie Wonder'],
  ['The Way You Make Me Feel', 'Michael Jackson'],
  ['This Will Be (An Everlasting Love)', 'Natalie Cole'],
  ['Unwritten', 'Natasha Bedingfield'],
  ['We Found Love', 'Rihanna feat. Calvin Harris'],
  ['You Make My Dreams', 'Daryl Hall & John Oates'],
] as const;

const songDisplay = ([title, artist]: (typeof songCatalog)[number]) => `${title} — ${artist}`;

export default function GuestRequestApp({ token }: { token: string }) {
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState<{ song: string; artist: string } | null>(null);
  const [songSearch, setSongSearch] = useState('');
  const [artist, setArtist] = useState('');
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    fetch(`/api/guest/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('This private event link is not active.');
        return response.json();
      })
      .then(setEvent)
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setStandalone(isStandalone);
    const handler = (browserEvent: Event) => {
      browserEvent.preventDefault();
      setInstallPrompt(browserEvent as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function submit(requestEvent: FormEvent<HTMLFormElement>) {
    requestEvent.preventDefault();
    setError('');
    setSending(true);
    const form = requestEvent.currentTarget;
    const values = new FormData(form);
    const matchedSong = songCatalog.find((song) => songDisplay(song).toLocaleLowerCase('en-US') === songSearch.toLocaleLowerCase('en-US'));
    const payload = { ...Object.fromEntries(values.entries()), song: matchedSong?.[0] ?? songSearch, artist };
    try {
      const response = await fetch(`/api/guest/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The request could not be sent.');
      setSubmitted({ song: String(payload.song), artist: String(payload.artist) });
      setEvent((current) => current ? { ...current, requestCount: result.requestCount } : current);
      setSongSearch('');
      setArtist('');
      form.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The request could not be sent.');
    } finally {
      setSending(false);
    }
  }

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setStandalone(true);
      setInstallPrompt(null);
    } else {
      setShowInstallHelp(true);
    }
  }

  const atLimit = event ? event.requestCount >= event.requestLimit : false;
  const canRequestAgain = event?.isOpen && !atLimit;

  function updateSongSearch(value: string) {
    setSongSearch(value);
    const match = songCatalog.find((song) => songDisplay(song).toLocaleLowerCase('en-US') === value.toLocaleLowerCase('en-US'));
    if (match) {
      setArtist(match[1]);
    }
  }

  return (
    <main className="guest-shell">
      <header className="guest-header">
        <div className="monogram" aria-label="DJ Request List"><span>JR</span></div>
        <div className="event-lockup">
          <p className="eyebrow">A dance floor production</p>
          <h1>{event?.eventName ?? 'DJ Request List'}</h1>
        </div>
        {!standalone ? <button className="install-orb" onClick={install} aria-label="Install DJ Request List">↓</button> : <span className="admin-link">DJ</span>}
      </header>

      <section className="request-card" aria-labelledby="request-heading" aria-busy={loading}>
        <div className="marquee-label">{event?.isOpen === false ? 'Requests closed' : 'Now accepting requests'}</div>
        <div className="card-intro">
          <p className="status-line"><span /> {event?.isOpen === false ? 'The request line is closed' : 'The request line is open'}</p>
          {event && <p className="counter">{String(event.requestCount).padStart(2, '0')} <span>/ {String(event.requestLimit).padStart(2, '0')}</span></p>}
        </div>

        {loading ? (
          <div className="state-panel"><p className="eyebrow">Loading the marquee…</p></div>
        ) : submitted ? (
          <div className="confirmation" role="status" aria-live="polite">
            <div className="ticket-check" aria-hidden="true">✓</div>
            <p className="eyebrow">Request received</p>
            <h2>It&apos;s with the DJ.</h2>
            <p><strong>{submitted.song}</strong> by {submitted.artist} has been added to tonight&apos;s request list.</p>
            {canRequestAgain && <button type="button" className="secondary-button" onClick={() => setSubmitted(null)}>Request another song</button>}
            {atLimit && <p className="limit-note">You&apos;ve used all {event?.requestLimit} requests for this device.</p>}
          </div>
        ) : (
          <>
            <div className="title-block">
              <p className="eyebrow">Tonight&apos;s feature presentation</p>
              <h2 id="request-heading">What should we play next?</h2>
              <p>{event?.welcomeMessage}</p>
            </div>
            {event && event.isOpen && !atLimit ? (
              <form className="request-form" onSubmit={submit}>
                <label>
                  <span>Search for a song</span>
                  <input value={songSearch} onChange={(change) => updateSongSearch(change.target.value)} required minLength={2} maxLength={240} list="song-catalog" placeholder="Start typing a title or artist" autoComplete="off" />
                  <datalist id="song-catalog">{songCatalog.map((song) => <option key={songDisplay(song)} value={songDisplay(song)} />)}</datalist>
                  <small className="field-hint">Choose a suggestion to fill the artist, or enter any song manually.</small>
                </label>
                <label><span>Artist</span><input name="artist" value={artist} onChange={(change) => setArtist(change.target.value)} required minLength={2} maxLength={120} placeholder="Who sings it?" autoComplete="off" /></label>
                <label><span>Reason <em>optional</em></span><input name="note" maxLength={120} placeholder="Why this song?" /></label>
                <label className="trap" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
                {error && <p className="form-error" role="alert">{error}</p>}
                <button type="submit" disabled={sending}>{sending ? 'Sending to the booth…' : 'Send to the DJ booth'} <span aria-hidden="true">→</span></button>
              </form>
            ) : (
              <div className="closed-message">
                <p>{error || (atLimit ? `This device has reached the ${event?.requestLimit}-request limit.` : 'The request line has closed for tonight.')}</p>
              </div>
            )}
          </>
        )}
      </section>

      {!loading && error && !event && <p className="page-error" role="alert">{error}</p>}
      <footer><p className="footer-script">One night only. Make it a good one.</p><p className="eyebrow">Private requests · Made for our favorite people</p></footer>

      {showInstallHelp && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowInstallHelp(false)}>
          <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={(click) => click.stopPropagation()}>
            <p className="eyebrow">Keep it on your Home Screen</p>
            <h2 id="install-title">Install DJ Request List</h2>
            <p>On iPhone, tap the Share button, then <strong>Add to Home Screen</strong>. On Android, open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
            <button type="button" onClick={() => setShowInstallHelp(false)}>Got it</button>
          </section>
        </div>
      )}
    </main>
  );
}
