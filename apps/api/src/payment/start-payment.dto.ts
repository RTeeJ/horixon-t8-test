import { IsIn, IsString, ValidateIf } from 'class-validator';

// Shape only. The amount's value rules (format, max, enough) belong to cashChange in the domain.
export class StartPaymentDto {
  @IsIn(['QR', 'CASH']) method: 'QR' | 'CASH';
  @ValidateIf((o: StartPaymentDto) => o.method === 'CASH') @IsString() cashReceived?: string;
}
