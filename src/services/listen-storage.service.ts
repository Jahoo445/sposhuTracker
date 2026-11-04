import { Injectable } from '@angular/core';

type ArtistAlbumListenCounts = Record<string, Record<string, number>>;

/** Listen counts from before listens were stored in the database; only read for the one-time import. */
@Injectable({
  providedIn: 'root'
})
export class ListenStorageService {
  private readonly _storageKey = 'album-listen-counts';

  public getListenCountsForArtist(artistId: string): Record<string, number> {
    return this._getAll()[ artistId ] ?? {};
  }

  public clearArtistListenCounts(artistId: string): void {
    const data = this._getAll();
    delete data[ artistId ];
    this._saveAll(data);
  }

  private _getAll(): ArtistAlbumListenCounts {
    try {
      const rawValue = localStorage.getItem(this._storageKey);
      return rawValue ? JSON.parse(rawValue) as ArtistAlbumListenCounts : {};
    } catch {
      // Storage blocked or broken: there is nothing to import then.
      return {};
    }
  }

  private _saveAll(data: ArtistAlbumListenCounts): void {
    try {
      if (Object.keys(data).length === 0) {
        localStorage.removeItem(this._storageKey);
      } else {
        localStorage.setItem(this._storageKey, JSON.stringify(data));
      }
    } catch {
      // Storage blocked: the import is simply tried again next time.
    }
  }
}
