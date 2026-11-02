import { DatePipe } from '@angular/common';
import { averageRating } from '../../utils/ratings';
import { ListenService } from '../../services/listen.service';
import { StarRating } from '../star-rating/star-rating';
import { SpotifyAlbumItem } from '../../types/SpotifyAlbumItem';
import { Listen, RatingTopic, Ratings } from '../../types/Listen';
import { RatingSummary } from '../rating-summary/rating-summary';
import {
  Component,
  DOCUMENT,
  DestroyRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';

@Component({
  selector: 'app-listen-dialog',
  standalone: true,
  imports: [ DatePipe, RatingSummary, StarRating ],
  templateUrl: './listen-dialog.html',
  styleUrls: [ './listen-dialog.scss' ]
})
export class ListenDialog {
  private readonly _listenService = inject(ListenService);

  constructor() {
    this._lockPageScroll();
  }

  /** Prevents the page behind the popup from scrolling while it is open. */
  private _lockPageScroll(): void {
    const document = inject(DOCUMENT);
    const body = document.body;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };

    body.style.overflow = 'hidden';
    // Keep the layout from jumping when the scrollbar disappears.
    body.style.paddingRight = `${scrollbarWidth}px`;

    inject(DestroyRef).onDestroy(() => {
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.paddingRight;
    });
  }

  public readonly artistId = input.required<string>();
  public readonly album = input.required<SpotifyAlbumItem>();
  public readonly topics = input.required<RatingTopic[]>();
  public readonly listens = input.required<Listen[]>();

  public readonly closed = output<void>();
  public readonly listenSaved = output<Listen>();
  public readonly listenDeleted = output<string>();

  protected readonly _stars = [ 1, 2, 3, 4, 5 ];

  protected readonly _ratings = signal<Ratings>({});
  protected readonly _hover = signal<{ topic: string; value: number } | null>(null);
  protected readonly _isSaving = signal<boolean>(false);
  protected readonly _deletingId = signal<string | null>(null);
  protected readonly _error = signal<string | null>(null);

  /** Listen from the history whose rating is being edited (null = rating a new listen). */
  protected readonly _editingId = signal<string | null>(null);
  protected readonly _editingListen = computed(
    () => this.listens().find(listen => listen.id === this._editingId()) ?? null
  );

  /** Topic that was just rated; drives the confirmation animation. */
  protected readonly _justRated = signal<string | null>(null);
  private _justRatedTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly _hasReviews = computed(() => averageRating(this.listens()) !== null);
  protected readonly _ratedCount = computed(() => Object.keys(this._ratings()).length);

  @HostListener('document:keydown.escape')
  protected _onEscape(): void {
    this.closed.emit();
  }

  /** Stars shown for a topic: the hovered value wins over the selected one. */
  protected _shownRating(topicKey: string): number {
    const hover = this._hover();
    return hover?.topic === topicKey ? hover.value : this._ratings()[ topicKey ] ?? 0;
  }

  protected _setRating(topicKey: string, value: number): void {
    const previous = this._ratings()[ topicKey ];
    const isClearing = previous === value;

    this._ratings.update(current => {
      const next = { ...current };

      if (isClearing) {
        delete next[ topicKey ];
      } else {
        next[ topicKey ] = value;
      }

      return next;
    });

    // Confirmation animation only when a category gets its first rating, not when it is changed.
    clearTimeout(this._justRatedTimer);
    this._justRated.set(null);

    if (previous === undefined) {
      // Short delay so the class is removed and re-added, restarting the CSS animation.
      this._justRatedTimer = setTimeout(() => {
        this._justRated.set(topicKey);
        this._justRatedTimer = setTimeout(() => this._justRated.set(null), 700);
      }, 16);
    }
  }

  protected _listenAverage(listen: Listen): number | null {
    return averageRating([ listen ]);
  }

  protected async _save(): Promise<void> {
    if (this._isSaving()) {
      return;
    }

    this._isSaving.set(true);
    this._error.set(null);

    try {
      const editingId = this._editingId();

      if (editingId) {
        this.listenSaved.emit(
          await this._listenService.updateListen(editingId, { ratings: this._ratings() })
        );
        this._cancelEdit();
        return;
      }

      this.listenSaved.emit(
        await this._listenService.createListen({
          artistId: this.artistId(),
          albumId: this.album().id,
          albumName: this.album().name,
          ratings: this._ratings()
        })
      );
      this.closed.emit();
    } catch {
      this._error.set('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      this._isSaving.set(false);
    }
  }

  protected _startEdit(listen: Listen): void {
    clearTimeout(this._justRatedTimer);
    this._justRated.set(null);
    this._editingId.set(listen.id);
    this._ratings.set({ ...listen.ratings });
    this._error.set(null);
  }

  protected _cancelEdit(): void {
    this._editingId.set(null);
    this._ratings.set({});
    this._error.set(null);
  }

  protected async _delete(listen: Listen): Promise<void> {
    this._deletingId.set(listen.id);
    this._error.set(null);

    try {
      await this._listenService.deleteListen(listen.id);
      this.listenDeleted.emit(listen.id);

      if (this._editingId() === listen.id) {
        this._cancelEdit();
      }
    } catch {
      this._error.set('Löschen fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      this._deletingId.set(null);
    }
  }
}
