import { NextResponse } from 'next/server';

type MusicBrainzRecording = {
  id?: string;
  title?: string;
  'artist-credit'?: Array<{ name?: string; joinphrase?: string }>;
};

type MusicBrainzResponse = { recordings?: MusicBrainzRecording[] };

function cleanQuery(value: string | null) {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

export async function GET(request: Request) {
  const query = cleanQuery(new URL(request.url).searchParams.get('q'));
  if (query.length < 2) return NextResponse.json({ suggestions: [] });

  const url = new URL('https://musicbrainz.org/ws/2/recording');
  url.searchParams.set('query', query);
  url.searchParams.set('fmt', 'json');
  url.searchParams.set('limit', '16');
  url.searchParams.set('dismax', 'true');

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DJRequestList/1.0 (https://dj-request-list.joshled101.chatgpt.site)',
      },
    });
    if (!response.ok) throw new Error(`Catalog returned ${response.status}`);

    const payload = await response.json() as MusicBrainzResponse;
    const seen = new Set<string>();
    const suggestions = (payload.recordings ?? []).flatMap((recording) => {
      const title = recording.title?.trim() ?? '';
      const artist = (recording['artist-credit'] ?? [])
        .map((credit) => `${credit.name ?? ''}${credit.joinphrase ?? ''}`)
        .join('')
        .trim();
      const key = `${title.toLocaleLowerCase('en-US')}|${artist.toLocaleLowerCase('en-US')}`;
      if (!title || !artist || seen.has(key)) return [];
      seen.add(key);
      return [{ id: recording.id ?? key, title, artist }];
    }).slice(0, 8);

    return NextResponse.json(
      { suggestions },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } },
    );
  } catch {
    return NextResponse.json({ suggestions: [], unavailable: true }, { status: 503 });
  }
}
