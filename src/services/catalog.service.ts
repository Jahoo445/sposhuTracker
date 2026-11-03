import { firstValueFrom } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../config';
import { Series } from '../types/Series';
import { SpotifyAlbumItem } from '../types/SpotifyAlbumItem';
import { episodeTitle, uniqueEpisodes } from '../utils/episodes';

/** Series and their episodes. Both come from the backend, which keeps the Spotify data cached. */
@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  private readonly _http = inject(HttpClient);

  /** The series in the user's library, with their pictures. */
  public async getSeries(): Promise<Series[]> {
    const series = await firstValueFrom(
      this._http.get<(Omit<Series, 'imageUrl'> & { imageUrl?: string | null })[]>(`${API_BASE_URL}/audiobooks`)
    );

    return series.map(({ artistId, artistName, imageUrl }) => ({ artistId, artistName, imageUrl: imageUrl ?? null }));
  }

  /** Name and picture of one series, also when it isn't in the user's library (shared links). */
  public getSeriesById(artistId: string): Promise<Series> {
    return firstValueFrom(this._http.get<Series>(`${API_BASE_URL}/series/${encodeURIComponent(artistId)}`));
  }

  /** The numbered episodes of a series, each once, with uniform titles. */
  public async getEpisodes(artistId: string): Promise<SpotifyAlbumItem[]> {
    const albums = await firstValueFrom(
      this._http.get<SpotifyAlbumItem[]>(
        `${API_BASE_URL}/media/${encodeURIComponent(artistId)}`,
        { params: { kind: 'audiobook' } }
      )
    );

    return uniqueEpisodes(albums).map(album => ({ ...album, name: episodeTitle(album.name) }));
  }
}
