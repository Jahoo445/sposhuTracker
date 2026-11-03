import { episodeTitle, isEpisode, uniqueEpisodes } from './episodes';

describe('isEpisode', () => {
  it.each([
    'Folge 241: Meister des Lichts',
    'Folge 7 - Titel',
    '208/Kelch des Schicksals',
    '134/ der tote Mönch'
  ])('keeps "%s"', name => expect(isEpisode(name)).toBe(true));

  it.each([
    'Mini-Fall/Achtung, Dinos! (Mini-Fall 04)',
    'Adventskalender - Gruselige Weihnacht überall',
    'Adventskalender/Die Marzipan-Mission',
    'Die Weihnachtsgeiseln (Adventskalender)',
    'Sommer-Fälle',
    'Jan Böhmermann liest... und die flüsternde Mumie',
    'Toteninsel (Das Original-Hörspiel zum Kinofilm)',
    'und das versunkene Schiff (Kopfhörer-Hörspiel)'
  ])('leaves out "%s"', name => expect(isEpisode(name)).toBe(false));
});

describe('uniqueEpisodes', () => {
  it('shows each episode number once, keeping the earliest release, in Spotify order', () => {
    const albums = [
      { name: '135/Next', release_date: '2010-01-01' },
      { name: '134/ der tote Mönch', release_date: '2019-05-05' },
      { name: 'Sommer-Fälle', release_date: '2020-01-01' },
      { name: '134/Der tote Mönch', release_date: '2009-10-03' },
      { name: 'Folge 133: Earlier', release_date: '2009-01-01' }
    ];

    expect(uniqueEpisodes(albums).map(album => album.name))
      .toEqual([ '135/Next', '134/Der tote Mönch', 'Folge 133: Earlier' ]);
  });
});

describe('episodeTitle', () => {
  it.each([
    [ '208/Kelch des Schicksals', 'Folge 208: Kelch des Schicksals' ],
    [ '071/Gefahr in den Ruinen', 'Folge 71: Gefahr in den Ruinen' ],
    [ 'Folge 007 - Titel', 'Folge 7: Titel' ],
    [ 'Folge 241: Meister des Lichts', 'Folge 241: Meister des Lichts' ]
  ])('"%s" → "%s"', (name, expected) => expect(episodeTitle(name)).toBe(expected));
});
