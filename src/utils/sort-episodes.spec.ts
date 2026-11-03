import { SpotifyAlbumItem } from '../types/SpotifyAlbumItem';
import { sortHeardEpisodes } from './sort-episodes';

const album = (id: string, name: string) => ({ id, name }) as SpotifyAlbumItem;
const albums = [ album('a', 'Folge 10: B'), album('b', 'Folge 2: A'), album('c', 'Folge 100: C'), album('d', 'Folge 3: D') ];
const averages = { a: 4, b: 2, c: null, d: 4 };
const counts = { a: 1, b: 3, c: 2, d: 1 };
const ids = (sorted: SpotifyAlbumItem[]) => sorted.map(entry => entry.id).join('');

describe('sortHeardEpisodes', () => {
  it('sorts by name with numbers in numeric order, and reversed', () => {
    expect(ids(sortHeardEpisodes(albums, 'name', false, averages, counts))).toBe('bdac');
    expect(ids(sortHeardEpisodes(albums, 'name', true, averages, counts))).toBe('cadb');
  });

  it('sorts by rating, best first, ties by name, unrated always last', () => {
    expect(ids(sortHeardEpisodes(albums, 'rating', false, averages, counts))).toBe('dabc');
    expect(ids(sortHeardEpisodes(albums, 'rating', true, averages, counts))).toBe('bdac');
  });

  it('sorts by listen count, most first, ties by name', () => {
    expect(ids(sortHeardEpisodes(albums, 'count', false, averages, counts))).toBe('bcda');
    expect(ids(sortHeardEpisodes(albums, 'count', true, averages, counts))).toBe('dacb');
  });

  it('does not change the input', () => {
    const copy = [ ...albums ];
    sortHeardEpisodes(albums, 'rating', false, averages, counts);
    expect(albums).toEqual(copy);
  });
});
