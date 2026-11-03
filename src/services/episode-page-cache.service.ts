import { Injectable } from '@angular/core';
import { SpotifyAlbumItem } from '../types/SpotifyAlbumItem';
import { Listen, RatingTopic } from '../types/Listen';

/** Everything the episode page needs to draw itself right away. */
export type EpisodePageData = {
  albums: SpotifyAlbumItem[];
  topics: RatingTopic[];
  listens: Listen[];
};

type StoredPage = EpisodePageData & { savedAt: number };

/**
 * Last loaded episode page per series, kept in localStorage: shown instantly on the next
 * visit, then replaced by the fresh data. Listens are personal, so the key includes the user.
 */
@Injectable({
  providedIn: 'root'
})
export class EpisodePageCacheService {
  private readonly _prefix = 'episode-page-cache:';

  public read(userId: string, artistId: string): EpisodePageData | null {
    try {
      const raw = localStorage.getItem(this._key(userId, artistId));
      if (!raw) return null;
      const { albums, topics, listens } = JSON.parse(raw) as StoredPage;
      return Array.isArray(albums) && Array.isArray(topics) && Array.isArray(listens)
        ? { albums, topics, listens }
        : null;
    } catch {
      return null;
    }
  }

  public write(userId: string, artistId: string, data: EpisodePageData): void {
    const page: StoredPage = { ...data, savedAt: Date.now() };
    try {
      localStorage.setItem(this._key(userId, artistId), JSON.stringify(page));
    } catch {
      // Storage full or blocked: the page just loads without the head start next time.
    }
  }

  /** Keeps the cached listens in step with saves and deletes made on the page. */
  public updateListens(userId: string, artistId: string, listens: Listen[]): void {
    const cached = this.read(userId, artistId);
    if (cached) this.write(userId, artistId, { ...cached, listens });
  }

  private _key(userId: string, artistId: string): string {
    return `${this._prefix}${userId}:${artistId}`;
  }
}
