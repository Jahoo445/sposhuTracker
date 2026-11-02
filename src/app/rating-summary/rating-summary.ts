import { DecimalPipe } from '@angular/common';
import { Listen, RatingTopic } from '../../types/Listen';
import { Component, computed, input } from '@angular/core';
import { averageRating, topicAverages } from '../../utils/ratings';

@Component({
  selector: 'app-rating-summary',
  standalone: true,
  imports: [ DecimalPipe ],
  templateUrl: './rating-summary.html',
  styleUrls: [ './rating-summary.scss' ],
  host: { '[class.compact]': 'compact()' }
})
export class RatingSummary {
  public readonly listens = input.required<Listen[]>();
  public readonly topics = input.required<RatingTopic[]>();
  public readonly compact = input<boolean>(false);

  protected readonly _stars = [ 1, 2, 3, 4, 5 ];

  protected readonly _average = computed(() => averageRating(this.listens()));

  protected readonly _reviewCount = computed(
    () => this.listens().filter(listen => Object.keys(listen.ratings).length > 0).length
  );

  protected readonly _topicRows = computed(() => {
    const averages = topicAverages(this.listens());

    return this.topics().map(topic => ({
      key: topic.key,
      label: topic.label,
      value: (averages[ topic.key ] as number | undefined) ?? null
    }));
  });

  /** Fill (0-100%) of the n-th star for the overall average. */
  protected _starFill(star: number): number {
    const average = this._average() ?? 0;
    return Math.max(0, Math.min(1, average - (star - 1))) * 100;
  }
}
