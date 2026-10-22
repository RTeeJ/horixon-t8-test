import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CurrentStaffInfo } from './current-staff.decorator';
import { IS_PUBLIC } from './public.decorator';
import { StaffEntity } from './staff.entity';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(StaffEntity) private readonly staff: Repository<StaffEntity>,
  ) {
    super();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    await super.canActivate(ctx); // throws 401 on a missing, forged or expired token
    // A signed token can outlive its staff row (a database reset), and the staff FKs would then fail with a 500.
    // Checked here, not in JwtStrategy.validate: passport keeps one strategy per process, this guard belongs to its app.
    // isActive is checked at login only (R§12).
    const { id } = ctx.switchToHttp().getRequest<{ user: CurrentStaffInfo }>().user;
    if (!(await this.staff.existsBy({ id }))) throw new UnauthorizedException();
    return true;
  }
}
