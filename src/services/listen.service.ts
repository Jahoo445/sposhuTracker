import { firstValueFrom } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../config';
import { Listen, ListenUpdate, NewListen, RatingTopic } from '../types/Listen';

type ImportAlbum = { albumId: string; albumName: string; count: number };

@Injectable({
  providedIn: 'root'
})
export class ListenService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = API_BASE_URL;

  private _topics: Promise<RatingTopic[]> | null = null;

  public getRatingTopics(): Promise<RatingTopic[]> {
    this._topics ??= firstValueFrom(
      this._http.get<RatingTopic[]>(`${this._baseUrl}/rating-topics`)
    ).catch(error => {
      this._topics = null;
      throw error;
    });

    return this._topics;
  }

  public getListensForArtist(artistId: string): Promise<Listen[]> {
    return firstValueFrom(
      this._http.get<Listen[]>(`${this._baseUrl}/listens`, { params: { artistId } })
    );
  }

  public createListen(listen: NewListen): Promise<Listen> {
    return firstValueFrom(this._http.post<Listen>(`${this._baseUrl}/listens`, listen));
  }

  public updateListen(id: string, update: ListenUpdate): Promise<Listen> {
    return firstValueFrom(
      this._http.patch<Listen>(`${this._baseUrl}/listens/${encodeURIComponent(id)}`, update)
    );
  }

  public async deleteListen(id: string): Promise<void> {
    await firstValueFrom(
      this._http.delete<void>(`${this._baseUrl}/listens/${encodeURIComponent(id)}`)
    );
  }

  public importListens(artistId: string, albums: ImportAlbum[]): Promise<Listen[]> {
    return firstValueFrom(
      this._http.post<Listen[]>(`${this._baseUrl}/listens/import`, { artistId, albums })
    );
  }
}
