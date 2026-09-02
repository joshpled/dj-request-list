import { NextResponse } from 'next/server';

type MusicBrainzRecording = {
  id?: string;
  score?: number;
  title?: string;
  'artist-credit'?: Array<{ name?: string; joinphrase?: string }>;
};

type MusicBrainzResponse = { recordings?: MusicBrainzRecording[] };

function cleanQuery(value: string | null) {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function escapeLuceneTerm(value: string) {
  return value.replace(/([+\-!(){}[\]^"~*?:\\/])/g, '\\$1');
}

function buildCatalogQuery(value: string) {
  const terms = value
    .split(' ')
    .map(escapeLuceneTerm)
    .filter(Boolean)
    .map((term, index, all) => `${term}${index === all.length - 1 ? '*' : ''}`)
    .join(' AND ');

  return `recording:(${terms}) OR artistname:(${terms})`;
}

function normalizeForMatch(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchScore(title: string, artist: string, query: string, catalogScore = 0) {
  const normalizedQuery = normalizeForMatch(query);
  const normalizedTitle = normalizeForMatch(title);
  const normalizedArtist = normalizeForMatch(artist);

  let relevance = Math.min(catalogScore, 100);
  if (normalizedArtist === normalizedQuery) relevance += 1_000;
  else if (normalizedArtist.startsWith(normalizedQuery)) relevance += 900;
  else if (normalizedArtist.includes(normalizedQuery)) relevance += 800;

  if (normalizedTitle === normalizedQuery) relevance += 950;
  else if (normalizedTitle.startsWith(normalizedQuery)) relevance += 700;
  else if (normalizedTitle.includes(normalizedQuery)) relevance += 600;

  return relevance;
}

export async function GET(request: Request) {
  const query = cleanQuery(new URL(request.url).searchParams.get('q'));
  if (query.length < 2) return NextResponse.json({ suggestions: [] });

  const url = new URL('https://musicbrainz.org/ws/2/recording');
  url.searchParams.set('query', buildCatalogQuery(query));
  url.searchParams.set('fmt', 'json');
  url.searchParams.set('limit', '50');

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DJRequestList/1.0 (https://dj-request-list.joshuapleduc.workers.dev)',
      },
    });
    if (!response.ok) throw new Error(`Catalog returned ${response.status}`);

    const payload = await response.json() as MusicBrainzResponse;
    const candidates = (payload.recordings ?? []).flatMap((recording) => {
      const title = recording.title?.trim() ?? '';
      const artist = (recording['artist-credit'] ?? [])
        .map((credit) => `${credit.name ?? ''}${credit.joinphrase ?? ''}`)
        .join('')
        .trim();
      if (!title || !artist) return [];
      return [{
        id: recording.id ?? `${title}|${artist}`,
        title,
        artist,
        relevance: matchScore(title, artist, query, recording.score),
      }];
    }).sort((a, b) => b.relevance - a.relevance);

    const seen = new Set<string>();
    const suggestions = candidates.flatMap(({ id, title, artist }) => {
      const key = `${normalizeForMatch(title)}|${normalizeForMatch(artist)}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ id, title, artist }];
    }).slice(0, 30);

    return NextResponse.json(
      { suggestions },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } },
    );
  } catch {
    return NextResponse.json({ suggestions: [], unavailable: true }, { status: 503 });
  }
}
