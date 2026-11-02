export type RatingTopic = {
  key: string;
  label: string;
};

export type Ratings = Record<string, number>;

export type Listen = {
  id: string;
  artistId: string;
  albumId: string;
  albumName: string;
  listenedAt: string;
  ratings: Ratings;
};

export type NewListen = {
  artistId: string;
  albumId: string;
  albumName: string;
  ratings: Ratings;
};

export type ListenUpdate = Pick<Listen, 'ratings'>;
