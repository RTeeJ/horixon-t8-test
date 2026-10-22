import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentStaffInfo {
  id: string;
  displayName: string;
}

export const CurrentStaff = createParamDecorator((_data: unknown, ctx: ExecutionContext): CurrentStaffInfo =>
  ctx.switchToHttp().getRequest().user,
);
