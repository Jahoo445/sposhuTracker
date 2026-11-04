import { Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { averageRating } from '../../utils/ratings';
import { ListenDialog } from '../listen-dialog/listen-dialog';
import { StarRating } from '../star-rating/star-rating';
import { RatingSummary } from '../rating-summary/rating-summary';
import { Listen, RatingTopic } from '../../types/Listen';
import { ListenService } from '../../services/listen.service';
import { CatalogService } from '../../services/catalog.service';
import { SpotifyAlbumItem } from '../../types/SpotifyAlbumItem';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ArtistCacheService } from '../../services/artist-cache.service';
import { ListenStorageService } from '../../services/listen-storage.service';
import { AuthService } from '../../services/auth.service';
import { EpisodePageCacheService, EpisodePageData } from '../../services/episode-page-cache.service';
import { HeardSort, sortHeardEpisodes } from '../../utils/sort-episodes';

type AlbumFilter = 'all' | 'unheard' | 'heard';

@Component({
  selector: 'app-artist-albums',
  standalone: true,
  imports: [ RouterLink, ListenDialog, RatingSummary, StarRating ],
  templateUrl: './artist-albums.html',
  styleUrls: [ './artist-albums.scss' ]
})
export class ArtistAlbums implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _location = inject(Location);
  private readonly _listenService = inject(ListenService);
  private readonly _catalogService = inject(CatalogService);
  private readonly _artistCacheService = inject(ArtistCacheService);
  private readonly _listenStorageService = inject(ListenStorageService);
  private readonly _authService = inject(AuthService);
  private readonly _pageCache = inject(EpisodePageCacheService);

  protected readonly _searchTerm = signal<string>('');
  protected readonly _isLoading = signal<boolean>(true);
  protected readonly _error = signal<string | null>(null);
  protected readonly _artistId = signal<string | null>(null);
  protected readonly _artistName = signal<string>('');
  protected readonly _artistImage = signal<string | null>(null);
  protected readonly _albums = signal<SpotifyAlbumItem[]>([]);
  protected readonly _filter = signal<AlbumFilter>('all');
  protected readonly _heardSort = signal<HeardSort>('name');
  /** Reversed order: Z–A, worst rating first, least listened first. */
  protected readonly _sortReversed = signal<boolean>(false);
  protected readonly _sortOptions: { value: HeardSort; label: string }[] = [
    { value: 'name', label: 'Name' },
    { value: 'rating', label: 'Bewertung' },
    { value: 'count', label: 'Anzahl gehört' }
  ];
  protected readonly _topics = signal<RatingTopic[]>([]);
  protected readonly _listens = signal<Listen[]>([]);
  protected readonly _selectedAlbum = signal<SpotifyAlbumItem | null>(null);

  /** Listens per album, newest first. */
  protected readonly _listensByAlbum = computed(() => {
    const result: Record<string, Listen[]> = {};

    for (const listen of this._listens()) {
      (result[ listen.albumId ] ??= []).push(listen);
    }

    for (const albumListens of Object.values(result)) {
      albumListens.sort((a, b) => b.listenedAt.localeCompare(a.listenedAt));
    }

    return result;
  });

  protected readonly _averageByAlbum = computed(() => {
    const result: Record<string, number | null> = {};

    for (const [ albumId, albumListens ] of Object.entries(this._listensByAlbum())) {
      result[ albumId ] = averageRating(albumListens);
    }

    return result;
  });

  protected readonly _selectedAlbumListens = computed(() => {
    const album = this._selectedAlbum();
    return album ? this._listensByAlbum()[ album.id ] ?? [] : [];
  });

  protected readonly _heardCount = computed(() => {
    const listensByAlbum = this._listensByAlbum();
    return this._albums().filter(album => listensByAlbum[ album.id ]?.length).length;
  });

  protected readonly _progressPercentage = computed(() => {
    const total = this._albums().length;
    return total === 0 ? 0 : Math.round((this._heardCount() / total) * 100);
  });

  protected readonly _filterOptions = computed(() => [
    { value: 'all' as const, label: 'Alle', count: this._albums().length },
    { value: 'unheard' as const, label: 'Ungehört', count: this._albums().length - this._heardCount() },
    { value: 'heard' as const, label: 'Gehört', count: this._heardCount() }
  ]);

  protected readonly _filteredAlbums = computed(() => {
    const filter = this._filter();
    const listensByAlbum = this._listensByAlbum();
    const searchTerm = this._searchTerm().trim().toLowerCase();

    const albums = this._albums().filter(album => {
      const heard = !!listensByAlbum[ album.id ]?.length;
      const matchesFilter = filter === 'all' || (filter === 'heard') === heard;
      const matchesSearch = !searchTerm || album.name.toLowerCase().includes(searchTerm);

      return matchesFilter && matchesSearch;
    });

    if (filter !== 'heard') {
      return albums;
    }

    const listenCounts = Object.fromEntries(
      Object.entries(listensByAlbum).map(([ albumId, albumListens ]) => [ albumId, albumListens.length ])
    );

    return sortHeardEpisodes(albums, this._heardSort(), this._sortReversed(), this._averageByAlbum(), listenCounts);
  });

  /** A newly chosen sort starts in its normal direction; the direction button flips it. */
  protected _selectSort(sort: HeardSort): void {
    if (this._heardSort() !== sort) {
      this._heardSort.set(sort);
      this._sortReversed.set(false);
    }
  }

  public async ngOnInit(): Promise<void> {
    const artistId = this._route.snapshot.paramMap.get('artistId');

    if (!artistId) {
      this._error.set('Es wurde keine Serie ausgewählt.');
      this._isLoading.set(false);
      return;
    }

    this._artistId.set(artistId);
    void this._loadArtistInfo(artistId);

    // Last visit's data first, so the page is there immediately; fresh data replaces it below.
    const userId = this._authService.user()?.id ?? null;
    const cached = userId ? this._pageCache.read(userId, artistId) : null;
    if (cached) {
      this._showPage(artistId, cached, false);
    }

    try {
      this._changesWhileLoading = { saved: new Map(), deleted: new Set() };

      const [ albums, topics, loadedListens ] = await Promise.all([
        this._catalogService.getEpisodes(artistId),
        this._listenService.getRatingTopics(),
        this._listenService.getListensForArtist(artistId)
      ]);

      // Saves and deletes made while loading aren't in the loaded list yet, so keep them.
      const listens = this._withChangesWhileLoading(loadedListens);
      this._changesWhileLoading = null;

      // Signed out (or switched accounts) while loading: show nothing more and don't cache it.
      if (this._authService.user()?.id !== userId) {
        return;
      }

      this._showPage(artistId, { albums, topics, listens }, true);
      if (userId) {
        this._pageCache.write(userId, artistId, { albums, topics, listens });
      }

      // Runs after the page is shown; it handles its own errors and must not turn the page into an error.
      void this._migrateLocalListenCounts(artistId, albums, listens);
    } catch {
      // With cached data on screen, a failed refresh isn't worth an error.
      if (!cached) {
        this._error.set('Folgen konnten nicht geladen werden.');
      }
    } finally {
      this._changesWhileLoading = null;
      this._isLoading.set(false);
    }
  }

  /** Saves and deletes since the fresh data was requested (null when nothing is loading). */
  private _changesWhileLoading: { saved: Map<string, Listen>; deleted: Set<string> } | null = null;

  private _withChangesWhileLoading(loaded: Listen[]): Listen[] {
    const changes = this._changesWhileLoading;

    if (!changes) {
      return loaded;
    }

    return [
      ...changes.saved.values(),
      ...loaded.filter(listen => !changes.saved.has(listen.id) && !changes.deleted.has(listen.id))
    ];
  }

  private _deepLinkHandled = false;

  /** `fresh` is false for the cached copy, which may lack episodes released since. */
  private _showPage(artistId: string, { albums, topics, listens }: EpisodePageData, fresh: boolean): void {
    this._albums.set(albums);
    this._topics.set(topics);
    this._listens.set(listens);
    this._isLoading.set(false);

    // An open popup keeps showing the same episode, now with the fresh data.
    const selected = this._selectedAlbum();
    if (selected) {
      this._selectedAlbum.set(albums.find(album => album.id === selected.id) ?? selected);
    }

    if (this._deepLinkHandled) return;

    // Deep link (artist/:artistId/:albumId) opens that episode right away. Only the fresh list
    // can tell that an episode doesn't exist, so the link stays until then.
    const albumId = this._route.snapshot.paramMap.get('albumId');
    const linkedAlbum = albumId ? albums.find(album => album.id === albumId) : undefined;

    if (linkedAlbum) {
      this._selectedAlbum.set(linkedAlbum);
      this._deepLinkHandled = true;
    } else if (!albumId || fresh) {
      if (albumId) this._location.replaceState(`/artist/${artistId}`);
      this._deepLinkHandled = true;
    }
  }

  /** Saves and deletes go into the cached copy too, so the next visit doesn't start out of date. */
  private _cacheListens(): void {
    const userId = this._authService.user()?.id;
    const artistId = this._artistId();
    if (userId && artistId) {
      this._pageCache.updateListens(userId, artistId, this._listens());
    }
  }

  /** The address bar follows the open popup, so every episode has its own link. */
  protected _openAlbum(album: SpotifyAlbumItem): void {
    this._deepLinkHandled = true;
    this._selectedAlbum.set(album);
    this._location.replaceState(`/artist/${this._artistId()}/${album.id}`);
  }

  protected _closeAlbum(): void {
    this._deepLinkHandled = true;
    this._selectedAlbum.set(null);
    this._location.replaceState(`/artist/${this._artistId()}`);
  }

  protected _onListenSaved(saved: Listen): void {
    this._changesWhileLoading?.saved.set(saved.id, saved);
    this._listens.update(current => [ saved, ...current.filter(listen => listen.id !== saved.id) ]);
    this._cacheListens();
  }

  protected _onListenDeleted(id: string): void {
    this._changesWhileLoading?.saved.delete(id);
    this._changesWhileLoading?.deleted.add(id);
    this._listens.update(current => current.filter(listen => listen.id !== id));
    this._cacheListens();
  }

  protected _updateSearchTerm(value: string): void {
    this._searchTerm.set(value);
  }

  private async _loadArtistInfo(artistId: string): Promise<void> {
    const cached = this._artistCacheService.getArtists().find(artist => artist.artistId === artistId);

    if (cached) {
      this._artistName.set(cached.artistName);
      this._artistImage.set(cached.imageUrl);
      return;
    }

    try {
      const series = await this._catalogService.getSeriesById(artistId);
      this._artistName.set(series.artistName);
      this._artistImage.set(series.imageUrl ?? null);
    } catch {
      // The header simply stays without name and image.
    }
  }

  /**
   * Listen counts used to live in localStorage. If this artist has no listens in the
   * database yet, upload the old counts once (as unrated listens) and drop the local copy.
   */
  private async _migrateLocalListenCounts(
    artistId: string,
    albums: SpotifyAlbumItem[],
    listens: Listen[]
  ): Promise<void> {
    const localCounts = this._listenStorageService.getListenCountsForArtist(artistId);
    const entries = Object.entries(localCounts).filter(([ , count ]) => count > 0);

    if (entries.length === 0) {
      return;
    }

    if (listens.length > 0) {
      // Database already has data for this artist; it is the source of truth now.
      this._listenStorageService.clearArtistListenCounts(artistId);
      return;
    }

    const albumNames = Object.fromEntries(albums.map(album => [ album.id, album.name ]));

    try {
      const imported = await this._listenService.importListens(
        artistId,
        entries.map(([ albumId, count ]) => ({
          albumId,
          albumName: albumNames[ albumId ] ?? '',
          count
        }))
      );

      this._listens.update(current => [ ...current, ...imported ]);
      this._cacheListens();
      this._listenStorageService.clearArtistListenCounts(artistId);
    } catch {
      // Keep the local data and retry on the next visit. Only the owner may import (403 for
      // anyone else), since the old counts were kept per browser, not per user.
    }
  }
}
