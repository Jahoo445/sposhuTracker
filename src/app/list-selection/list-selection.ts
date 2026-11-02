import { Router } from '@angular/router';
import { AudiobookArtist } from '../../types/AudiobookArtist';
import { SpotifyService } from '../../services/spotify.service';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AudiobookService } from '../../services/audiobook.service';
import { ArtistCacheService } from '../../services/artist-cache.service';
import { AudiobookArtistWithImage } from '../../types/AudiobookArtistWithImage';

@Component({
  selector: 'app-list-selection',
  standalone: true,
  templateUrl: './list-selection.html',
  styleUrl: './list-selection.scss'
})
export class ListSelection implements OnInit {
  private readonly _audiobookService = inject(AudiobookService);
  private readonly _spotifyService = inject(SpotifyService);
  private readonly _artistCacheService = inject(ArtistCacheService);
  private readonly _router = inject(Router);

  protected readonly _audiobooks = signal<AudiobookArtistWithImage[]>([]);
  protected readonly _isLoading = signal<boolean>(true);
  protected readonly _isRefreshing = signal<boolean>(false);
  protected readonly _error = signal<string | null>(null);

  public async ngOnInit(): Promise<void> {
    const cachedArtists = this._artistCacheService.getArtists();

    if (cachedArtists.length > 0) {
      this._audiobooks.set(cachedArtists);
      this._isLoading.set(false);
      this._isRefreshing.set(true);

      try {
        await this._refreshArtists();
      } finally {
        this._isRefreshing.set(false);
      }

      return;
    }

    try {
      await this._refreshArtists();
    } catch {
      this._error.set('Hörspiele konnten nicht geladen werden.');
    } finally {
      this._isLoading.set(false);
    }
  }

  protected _selectAudiobook(audiobook: AudiobookArtistWithImage): void {
    void this._router.navigate([ '/artist', audiobook.artistId ]);
  }

  private async _refreshArtists(): Promise<void> {
    try {
      const artists = await this._audiobookService.getAudiobookArtists();

      const artistsWithImages = await Promise.all(
        artists.map(async (artist: AudiobookArtist) => {
          const spotifyArtist = await this._spotifyService.getArtist(artist.artistId);

          return {
            artistName: artist.artistName,
            artistId: artist.artistId,
            imageUrl: spotifyArtist.images[ 0 ]?.url ?? null
          };
        })
      );

      if (!this._areArtistsEqual(this._audiobooks(), artistsWithImages)) {
        this._audiobooks.set(artistsWithImages);
        this._artistCacheService.setArtists(artistsWithImages);
      }
    } catch {
      if (this._audiobooks().length === 0) {
        throw new Error('Künstler konnten nicht aktualisiert werden.');
      }
    }
  }

  private _areArtistsEqual(
    currentArtists: AudiobookArtistWithImage[],
    nextArtists: AudiobookArtistWithImage[]
  ): boolean {
    if (currentArtists.length !== nextArtists.length) {
      return false;
    }

    return currentArtists.every((currentArtist, index) => {
      const nextArtist = nextArtists[ index ];

      return (
        currentArtist.artistId === nextArtist.artistId &&
        currentArtist.artistName === nextArtist.artistName &&
        currentArtist.imageUrl === nextArtist.imageUrl
      );
    });
  }
}