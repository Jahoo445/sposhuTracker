import { Injectable } from '@angular/core';
import { Series } from '../types/Series';

type SeriesCache = {
  updatedAt: number;
  artists: Series[];
};

/** Last loaded series list, kept in localStorage so the start page shows up instantly. */
@Injectable({
  providedIn: 'root'
})
export class ArtistCacheService {
  private readonly _storageKey = 'artist-selection-cache';

  public getArtists(): Series[] {
    return this._getCache()?.artists ?? [];
  }

  public setArtists(artists: Series[]): void {
    const cache: SeriesCache = { updatedAt: Date.now(), artists };

    try {
      localStorage.setItem(this._storageKey, JSON.stringify(cache));
    } catch {
      // Storage full or blocked: the list just loads without the head start next time.
    }
  }

  public clear(): void {
    try {
      localStorage.removeItem(this._storageKey);
    } catch {
      // Nothing stored then.
    }
  }

  private _getCache(): SeriesCache | null {
    try {
      const rawValue = localStorage.getItem(this._storageKey);
      return rawValue ? JSON.parse(rawValue) as SeriesCache : null;
    } catch {
      return null;
    }
  }
}
