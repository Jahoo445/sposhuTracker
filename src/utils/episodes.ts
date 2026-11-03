/**
 * Numbered episodes ("Folge 12: …", "Folge 12 - …" or "012/…"). Specials, mini cases,
 * advent calendars, compilations and readings are left out, the same as in SpoShu's shuffler.
 */
const EPISODE_NAME = /^(?:Folge\s+0*(\d+)\s*[:\-–]|0*(\d+)\s*\/)/i;

/** The episode number, or null if the album isn't a numbered episode. */
export function episodeNumber(name: string): number | null {
  const match = name.trim().match(EPISODE_NAME);
  return match ? Number(match[ 1 ] ?? match[ 2 ]) : null;
}

/** Whether a Spotify album of a series is a numbered episode. */
export function isEpisode(name: string): boolean {
  return episodeNumber(name) !== null;
}

/**
 * Only the numbered episodes, each number once. Spotify sometimes lists an episode twice
 * (e.g. "134/Der tote Mönch" and "134/ der tote Mönch"); the earliest release is kept.
 */
export function uniqueEpisodes<T extends { name: string; release_date?: string }>(albums: T[]): T[] {
  const byNumber = new Map<number, T>();

  for (const album of albums) {
    const number = episodeNumber(album.name);
    if (number === null) continue;

    const kept = byNumber.get(number);
    if (!kept || (album.release_date ?? '') < (kept.release_date ?? '')) {
      byNumber.set(number, album);
    }
  }

  // Keep Spotify's order.
  return albums.filter(album => {
    const number = episodeNumber(album.name);
    return number !== null && byNumber.get(number) === album;
  });
}

/**
 * Spotify names episodes inconsistently, even within one series. This brings them into one shape:
 * "208/Kelch des Schicksals" and "Folge 007 - Titel" → "Folge 208: Kelch des Schicksals", "Folge 7: Titel".
 */
export function episodeTitle(name: string): string {
  const title = name.trim();

  const numbered = title.match(/^0*(\d+)\s*\/\s*(.+)$/);
  if (numbered) return `Folge ${numbered[ 1 ]}: ${numbered[ 2 ]}`;

  const folge = title.match(/^Folge\s+0*(\d+)\s*[:\-–]\s*(.+)$/i);
  if (folge) return `Folge ${folge[ 1 ]}: ${folge[ 2 ]}`;

  return title;
}
