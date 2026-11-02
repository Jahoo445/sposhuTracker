import { Routes } from '@angular/router';
import { Login } from './login/login';
import { ListSelection } from './list-selection/list-selection';
import { ArtistAlbums } from './artist-albums/artist-albums';
import { authGuard, guestGuard } from '../services/auth.guard';

export const routes: Routes = [
    {
        path: 'login',
        component: Login,
        canActivate: [ guestGuard ]
    },
    {
        path: '',
        component: ListSelection,
        canActivate: [ authGuard ]
    },
    {
        path: 'artist/:artistId',
        component: ArtistAlbums,
        canActivate: [ authGuard ]
    },
    {
        path: 'artist/:artistId/:albumId',
        component: ArtistAlbums,
        canActivate: [ authGuard ]
    },
    {
        path: '**',
        redirectTo: ''
    }
];
