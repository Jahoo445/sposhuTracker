import { Listen } from '../types/Listen';

function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Average of every topic rating given across the listens, or null when nothing is rated. */
export function averageRating(listens: Listen[]): number | null {
  return mean(listens.flatMap(listen => Object.values(listen.ratings)));
}

/** Average rating per topic key across the listens (topics without ratings are left out). */
export function topicAverages(listens: Listen[]): Record<string, number> {
  const valuesByTopic: Record<string, number[]> = {};

  for (const listen of listens) {
    for (const [ key, value ] of Object.entries(listen.ratings)) {
      (valuesByTopic[ key ] ??= []).push(value);
    }
  }

  const result: Record<string, number> = {};

  for (const [ key, values ] of Object.entries(valuesByTopic)) {
    result[ key ] = mean(values) as number;
  }

  return result;
}
