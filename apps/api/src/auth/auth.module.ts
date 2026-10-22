import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CONFIG } from '../common/config.token';
import type { AppConfig } from '../common/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';
import { JwtStrategy } from './jwt.strategy';
import { StaffEntity } from './staff.entity';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([StaffEntity]),
    JwtModule.registerAsync({
      inject: [CONFIG],
      useFactory: (cfg: AppConfig) => ({ secret: cfg.jwtSecret, signOptions: { expiresIn: '8h' } }),
    }),
  ],
  providers: [AuthService, JwtStrategy, { provide: APP_GUARD, useClass: JwtGuard }],
  controllers: [AuthController],
})
export class AuthModule {}
