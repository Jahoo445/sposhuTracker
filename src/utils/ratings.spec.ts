import { Listen } from '../types/Listen';
import { averageRating, topicAverages } from './ratings';

const listen = (ratings: Record<string, number>): Listen => ({
  id: 'x', artistId: 'a', albumId: 'b', albumName: 'c', listenedAt: '2026-01-01T00:00:00Z', ratings
});

describe('ratings', () => {
  it('averages every topic rating across listens', () => {
    expect(averageRating([ listen({ story: 5, speakers: 3 }), listen({ story: 1 }) ])).toBe(3);
  });

  it('is null when nothing is rated', () => {
    expect(averageRating([])).toBeNull();
    expect(averageRating([ listen({}) ])).toBeNull();
  });

  it('averages per topic and leaves unrated topics out', () => {
    expect(topicAverages([ listen({ story: 5, speakers: 2 }), listen({ story: 4 }) ])).toEqual({ story: 4.5, speakers: 2 });
  });
});
