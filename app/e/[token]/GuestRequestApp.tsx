'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type EventInfo = {
  eventName: string;
  requestLimit: number;
  closingTime: string | null;
  requestCount: number;
  isOpen: boolean;
};

type SongSuggestion = { id: string; title: string; artist: string };

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function GuestRequestApp({ token }: { token: string }) {
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState<{ song: string; artist: string } | null>(null);
  const [songSearch, setSongSearch] = useState('');
  const [artist, setArtist] = useState('');
  const [suggestions, setSuggestions] = useState<SongSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [searchingCatalog, setSearchingCatalog] = useState(false);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);
  const skipNextCatalogSearch = useRef(false);
  const songSearchRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    function dismissOutsideSearch(pointerEvent: PointerEvent) {
      if (!songSearchRef.current?.contains(pointerEvent.target as Node)) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener('pointerdown', dismissOutsideSearch);
    return () => document.removeEventListener('pointerdown', dismissOutsideSearch);
  }, []);

  useEffect(() => {
    const query = songSearch.trim();
    if (skipNextCatalogSearch.current) {
      skipNextCatalogSearch.current = false;
      return;
    }
    if (query.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchingCatalog(true);
      setCatalogUnavailable(false);
      try {
        const response = await fetch(`/api/catalog?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error('Catalog unavailable');
        setSuggestions(Array.isArray(result.suggestions) ? result.suggestions : []);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setSuggestions([]);
        setCatalogUnavailable(true);
      } finally {
        if (!controller.signal.aborted) setSearchingCatalog(false);
      }
    }, 650);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [songSearch]);

  async function submit(requestEvent: FormEvent<HTMLFormElement>) {
    requestEvent.preventDefault();
    setError('');
    setSending(true);
    const form = requestEvent.currentTarget;
    const values = new FormData(form);
    const payload = { ...Object.fromEntries(values.entries()), song: songSearch, artist };
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
      setSuggestions([]);
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

  function chooseSuggestion(suggestion: SongSuggestion) {
    skipNextCatalogSearch.current = true;
    setSongSearch(suggestion.title);
    setArtist(suggestion.artist);
    setSuggestions([]);
    setSuggestionsOpen(false);
  }

  function updateSongSearch(value: string) {
    setSongSearch(value);
    setSuggestionsOpen(value.trim().length >= 2);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setSearchingCatalog(false);
      setCatalogUnavailable(false);
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
            {event && event.isOpen && !atLimit ? (
              <form className="request-form" onSubmit={submit} aria-labelledby="request-heading">
                <h2 id="request-heading" className="sr-only">Request a song</h2>
                <label>
                  <span>Search by song or artist</span>
                  <div
                    className="song-search"
                    ref={songSearchRef}
                    onBlur={(blurEvent) => {
                      if (blurEvent.relatedTarget && !blurEvent.currentTarget.contains(blurEvent.relatedTarget as Node)) {
                        setSuggestionsOpen(false);
                      }
                    }}
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key === 'Escape') setSuggestionsOpen(false);
                    }}
                  >
                    <input
                      value={songSearch}
                      onChange={(change) => updateSongSearch(change.target.value)}
                      onFocus={() => setSuggestionsOpen(true)}
                      required
                      minLength={2}
                      maxLength={120}
                      placeholder="Start typing a title or artist"
                      autoComplete="off"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={suggestionsOpen && suggestions.length > 0}
                      aria-controls="song-suggestions"
                    />
                    {searchingCatalog && <span className="search-spinner" aria-label="Searching song catalog" />}
                    {suggestionsOpen && suggestions.length > 0 && (
                      <div className="song-suggestions" id="song-suggestions" role="listbox" aria-label="Song search results" tabIndex={0} key={songSearch}>
                        {suggestions.map((suggestion) => (
                          <button key={suggestion.id} type="button" role="option" onClick={() => chooseSuggestion(suggestion)}>
                            <strong>{suggestion.title}</strong>
                            <span>{suggestion.artist}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <small className="field-hint">{catalogUnavailable ? 'Online suggestions are unavailable—enter the song and artist manually.' : 'Scroll through the matches and choose a song, or enter one manually.'}</small>
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
