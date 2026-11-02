import { ActivatedRoute, Router } from '@angular/router';
import { AfterViewInit, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.html',
  styleUrls: [ './login.scss' ]
})
export class Login implements AfterViewInit {
  private readonly _auth = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);

  private readonly _button = viewChild<ElementRef<HTMLElement>>('googleButton');

  protected readonly _isConfigured = this._auth.isConfigured;
  protected readonly _isLoading = signal<boolean>(true);
  protected readonly _error = signal<string | null>(null);

  public ngAfterViewInit(): void {
    const element = this._button()?.nativeElement;

    if (!this._isConfigured || !element) {
      this._isLoading.set(false);
      return;
    }

    void this._showGoogleButton(element);
  }

  private async _showGoogleButton(element: HTMLElement): Promise<void> {
    try {
      const loggedIn = this._auth.renderGoogleButton(element);
      this._isLoading.set(false);
      await loggedIn;

      const returnUrl = this._route.snapshot.queryParamMap.get('returnUrl');
      await this._router.navigateByUrl(returnUrl?.startsWith('/') ? returnUrl : '/');
    } catch {
      this._isLoading.set(false);
      this._error.set('Anmeldung fehlgeschlagen. Bitte erneut versuchen.');
      void this._showGoogleButton(element);
    }
  }
}
