# Hörspiel-Checker

Track which episodes of your audio-drama series you've heard, and rate every listen on several topics.
Live at **https://tracker.sposhu.ch**. It belongs to [SpoShu](https://sposhu.ch) and shares its login.

## How it works

- **Series list → episode page → rating popup.** Every episode has its own link: `/artist/<artistId>/<albumId>`.
  SpoShu's "Rate episode" button opens exactly that.
- **Data** comes from the backend (project *servering*, `https://api.janishofstetter.com/sposhu`):
  - `/audiobooks` lists the series of the user's library, with pictures.
  - `/media/<artistId>?kind=audiobook` lists the episodes (Spotify data, cached by the backend).
  - `/listens` and `/rating-topics` hold the listens and ratings in MongoDB, separate per user.
- **Login** is Google sign-in. The backend issues a session token, kept in the cookie `sposhu_session` on
  `.sposhu.ch`, so signing in or out in SpoShu or here counts for both.
- **Offline head start:** the series list and each episode page are kept in `localStorage` and shown right away
  on the next visit, then replaced by fresh data. They are deleted when the session ends.

## Project layout

| Path | What's there |
| --- | --- |
| `src/config.ts` | Backend address and Google client ID |
| `src/app/` | Pages (`login`, `list-selection`, `artist-albums`) and components (`listen-dialog`, `rating-summary`, `star-rating`) |
| `src/services/` | Backend access (`catalog`, `listen`), login (`auth`, guard, interceptor, shared cookie) and the local caches |
| `src/utils/` | Pure helpers with unit tests: episode filter and titles, rating averages, sorting |

## Development

```bash
npm install
npx ng serve --port 4201   # SpoShu usually runs on 4200; the login is shared across localhost ports
npx ng test --watch=false  # unit tests (Vitest)
npx ng build               # production build into dist/
```

For Google sign-in to work locally, `http://localhost:4201` has to be listed as an authorized JavaScript
origin of the Google client.
