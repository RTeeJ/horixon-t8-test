import { CanActivate, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONFIG } from '../common/config.token';
import type { AppConfig } from '../common/config';

/** 404 for everyone unless APP_ENV=dev (R§11.1). A guard, not conditional registration, so tests can flip CONFIG. */
@Injectable()
export class DevOnlyGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly cfg: AppConfig) {}

  canActivate(): boolean {
    if (this.cfg.appEnv !== 'dev') throw new NotFoundException();
    return true;
  }
}
