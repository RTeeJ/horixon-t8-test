import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare } from 'bcrypt';
import { Repository } from 'typeorm';
import { ApiException } from '../common/api-error';
import { CONFIG } from '../common/config.token';
import type { AppConfig } from '../common/config';
import { StaffEntity } from './staff.entity';

// Hash of a random string, compared when the user is unknown so timing matches a real check.
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.bYh3p1Zl5kq5q6Gm4wUq0Qm9Xc1e';

export interface LoginResult {
  accessToken: string;
  staff: { id: string; displayName: string };
  appEnv: 'dev' | 'prod';
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(StaffEntity) private readonly staff: Repository<StaffEntity>,
    private readonly jwt: JwtService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  async login(username: string, password: string): Promise<LoginResult> {
    const user = await this.staff.findOne({ where: { username } });
    const ok = await compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.isActive || !ok) throw new ApiException(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS');
    const accessToken = await this.jwt.signAsync({ sub: user.id, name: user.displayName });
    return { accessToken, staff: { id: user.id, displayName: user.displayName }, appEnv: this.cfg.appEnv };
  }
}
