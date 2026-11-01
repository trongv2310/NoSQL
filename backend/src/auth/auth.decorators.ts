import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthRequest, NguoiDung } from './auth.types';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): NguoiDung | undefined => {
  return ctx.switchToHttp().getRequest<AuthRequest>().user;
});
