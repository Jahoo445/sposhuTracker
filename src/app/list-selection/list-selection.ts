import { Router } from '@angular/router';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Series } from '../../types/Series';
import { CatalogService } from '../../services/catalog.service';
import { ArtistCacheService } from '../../services/artist-cache.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-list-selection',
  standalone: true,
  templateUrl: './list-selection.html',
  styleUrl: './list-selection.scss'
})
export class ListSelection implements OnInit {
  private readonly _catalogService = inject(CatalogService);
  private readonly _artistCacheService = inject(ArtistCacheService);
  private readonly _router = inject(Router);
  private readonly _authService = inject(AuthService);

  protected readonly _audiobooks = signal<Series[]>([]);
  protected readonly _isLoading = signal<boolean>(true);
  protected readonly _error = signal<string | null>(null);

  public async ngOnInit(): Promise<void> {
    // Last visit's list first, so the page is there immediately; the fresh list replaces it below.
    const cached = this._artistCacheService.getArtists();

    if (cached.length > 0) {
      this._audiobooks.set(cached);
      this._isLoading.set(false);
    }

    const userId = this._authService.user()?.id;

    try {
      const series = await this._catalogService.getSeries();

      // Signed out (or switched accounts) while loading: don't put the list back into the cache.
      if (this._authService.user()?.id !== userId) {
        return;
      }

      if (!this._isSameList(this._audiobooks(), series)) {
        this._audiobooks.set(series);
      }
      this._artistCacheService.setArtists(series);
    } catch {
      // With the cached list on screen, a failed refresh isn't worth an error.
      if (cached.length === 0) {
        this._error.set('Hörspiele konnten nicht geladen werden.');
      }
    } finally {
      this._isLoading.set(false);
    }
  }

  protected _selectAudiobook(audiobook: Series): void {
    void this._router.navigate([ '/artist', audiobook.artistId ]);
  }

  private _isSameList(current: Series[], next: Series[]): boolean {
    return current.length === next.length && current.every((series, index) =>
      series.artistId === next[ index ].artistId &&
      series.artistName === next[ index ].artistName &&
      series.imageUrl === next[ index ].imageUrl
    );
  }
}
