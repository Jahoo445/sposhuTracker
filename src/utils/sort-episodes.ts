import { SpotifyAlbumItem } from '../types/SpotifyAlbumItem';

export type HeardSort = 'name' | 'rating' | 'count';

const nameCollator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

/**
 * Heard episodes by name (A–Z), by rating (best first) or by listen count (most first),
 * or the other way round when reversed. Unrated episodes always stay at the end; ties go by name.
 */
export function sortHeardEpisodes(
  albums: SpotifyAlbumItem[],
  sort: HeardSort,
  reversed: boolean,
  averages: Record<string, number | null>,
  listenCounts: Record<string, number>
): SpotifyAlbumItem[] {
  const direction = reversed ? -1 : 1;
  const byName = (a: SpotifyAlbumItem, b: SpotifyAlbumItem) => nameCollator.compare(a.name, b.name);

  return [ ...albums ].sort((a, b) => {
    if (sort === 'name') {
      return direction * byName(a, b);
    }

    if (sort === 'rating') {
      const ratingA = averages[ a.id ] ?? null;
      const ratingB = averages[ b.id ] ?? null;

      if (ratingA === null || ratingB === null) {
        if (ratingA !== ratingB) return ratingA === null ? 1 : -1;
      } else if (ratingA !== ratingB) {
        return direction * (ratingB - ratingA);
      }
    } else {
      const difference = (listenCounts[ b.id ] ?? 0) - (listenCounts[ a.id ] ?? 0);
      if (difference !== 0) return direction * difference;
    }

    return byName(a, b);
  });
}
