import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';

/** Read-only 5-star display with partially filled stars and the numeric value. */
@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [ DecimalPipe ],
  template: `
    @if (value() !== null) {
      <span class="stars" aria-hidden="true">
        @for (star of stars; track star) {
          <span class="star">★<span class="fill" [style.width.%]="fill(star)">★</span></span>
        }
      </span>
      <span class="value">{{ value() | number: '1.1-1' }}</span>
    } @else {
      <span class="empty">{{ emptyText() }}</span>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 6px; line-height: 1; }
    .stars { display: inline-flex; }
    .star { position: relative; color: #334155; }
    .fill { position: absolute; inset: 0 auto 0 0; overflow: hidden; color: #facc15; }
    .value { color: #facc15; font-weight: 600; font-size: 0.9em; font-variant-numeric: tabular-nums; }
    .empty { color: #64748b; font-size: 0.85em; }
  `
})
export class StarRating {
  public readonly value = input<number | null>(null);
  public readonly emptyText = input<string>('Nicht bewertet');

  protected readonly stars = [ 1, 2, 3, 4, 5 ];

  protected fill(star: number): number {
    return Math.max(0, Math.min(1, (this.value() ?? 0) - (star - 1))) * 100;
  }
}
