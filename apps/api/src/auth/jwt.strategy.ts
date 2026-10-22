import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CONFIG } from '../common/config.token';
import type { AppConfig } from '../common/config';
import type { CurrentStaffInfo } from './current-staff.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(CONFIG) cfg: AppConfig) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: cfg.jwtSecret,
      ignoreExpiration: false,
    });
  }

  validate(payload: { sub: string; name: string }): CurrentStaffInfo {
    return { id: payload.sub, displayName: payload.name };
  }
}
