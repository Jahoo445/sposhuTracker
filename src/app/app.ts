import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-root',
  imports: [ RouterOutlet, RouterLink ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly _auth = inject(AuthService);

  protected readonly _user = this._auth.user;

  protected _logout(): void {
    this._auth.logout();
  }
}
