import { Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { averageRating } from '../../utils/ratings';
import { ListenDialog } from '../listen-dialog/listen-dialog';
import { StarRating } from '../star-rating/star-rating';
import { RatingSummary } from '../rating-summary/rating-summary';
import { Listen, RatingTopic } from '../../types/Listen';
import { ListenService } from '../../services/listen.service';
import { SpotifyService } from '../../services/spotify.service';
import { SpotifyAlbumItem } from '../../types/SpotifyAlbumItem';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ArtistCacheService } from '../../services/artist-cache.service';
import { ListenStorageService } from '../../services/listen-storage.service';

type AlbumFilter = 'all' | 'unheard' | 'heard';
type HeardSort = 'name' | 'rating' | 'count';

const nameCollator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

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
  private readonly _spotifyService = inject(SpotifyService);
  private readonly _artistCacheService = inject(ArtistCacheService);
  private readonly _listenStorageService = inject(ListenStorageService);

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

    return filter === 'heard' ? this._sortHeard(albums) : albums;
  });

  /** A newly chosen sort starts in its normal direction; the direction button flips it. */
  protected _selectSort(sort: HeardSort): void {
    if (this._heardSort() !== sort) {
      this._heardSort.set(sort);
      this._sortReversed.set(false);
    }
  }

  /**
   * Heard episodes: by name (A–Z), by rating (best first) or by listen count (most first),
   * or the other way round when reversed. Unrated episodes always stay at the end; ties go by name.
   */
  private _sortHeard(albums: SpotifyAlbumItem[]): SpotifyAlbumItem[] {
    const sort = this._heardSort();
    const direction = this._sortReversed() ? -1 : 1;
    const averages = this._averageByAlbum();
    const listensByAlbum = this._listensByAlbum();
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
        const difference = (listensByAlbum[ b.id ]?.length ?? 0) - (listensByAlbum[ a.id ]?.length ?? 0);
        if (difference !== 0) return direction * difference;
      }

      return byName(a, b);
    });
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

    try {
      const [ albums, topics, listens ] = await Promise.all([
        this._spotifyService.getArtistAlbums(artistId),
        this._listenService.getRatingTopics(),
        this._listenService.getListensForArtist(artistId)
      ]);

      this._albums.set(albums);
      this._topics.set(topics);
      this._listens.set(listens);

      // Deep link (artist/:artistId/:albumId) opens that episode right away.
      const albumId = this._route.snapshot.paramMap.get('albumId');
      const linkedAlbum = albumId ? albums.find(album => album.id === albumId) : undefined;

      if (linkedAlbum) {
        this._selectedAlbum.set(linkedAlbum);
      } else if (albumId) {
        this._location.replaceState(`/artist/${artistId}`);
      }

      await this._migrateLocalListenCounts(artistId, albums, listens);
    } catch {
      this._error.set('Folgen konnten nicht geladen werden.');
    } finally {
      this._isLoading.set(false);
    }
  }

  /** The address bar follows the open popup, so every episode has its own link. */
  protected _openAlbum(album: SpotifyAlbumItem): void {
    this._selectedAlbum.set(album);
    this._location.replaceState(`/artist/${this._artistId()}/${album.id}`);
  }

  protected _closeAlbum(): void {
    this._selectedAlbum.set(null);
    this._location.replaceState(`/artist/${this._artistId()}`);
  }

  protected _onListenSaved(saved: Listen): void {
    this._listens.update(current => [ saved, ...current.filter(listen => listen.id !== saved.id) ]);
  }

  protected _onListenDeleted(id: string): void {
    this._listens.update(current => current.filter(listen => listen.id !== id));
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
      const artist = await this._spotifyService.getArtist(artistId);
      this._artistName.set(artist.name);
      this._artistImage.set(artist.images[ 0 ]?.url ?? null);
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
      this._listenStorageService.clearArtistListenCounts(artistId);
    } catch {
      // Keep the local data and retry on the next visit.
    }
  }
}
