import { SpotifyImage } from "./SpotifyImage";

/** One episode as the backend's /media endpoint returns it (a trimmed Spotify album). */
export type SpotifyAlbumItem = {
  id: string;
  type: 'album';
  name: string;
  images: SpotifyImage[];
  release_date: string;
  total_tracks: number;
  external_urls: {
    spotify: string;
  };
};
