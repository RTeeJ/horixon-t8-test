import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_VOID_NOTE, VOID_REASONS, VoidReason } from '@coffee/domain';

// Shape and length only; "OTHER needs a note" is checkVoid's rule (VOID_NOTE_REQUIRED).
export class VoidOrderDto {
  @IsIn(VOID_REASONS) reasonCode: VoidReason;
  @IsOptional() @IsString() @MaxLength(MAX_VOID_NOTE) note?: string;
}
