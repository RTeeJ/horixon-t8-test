import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import type { LineInput, OrderInput } from '@coffee/domain';

// Shape and types only. Value rules (non-empty, >= 1, integers, limits) belong to quoteOrder,
// so the API and the web report the same codes.
export class AddOnDto {
  @IsString() code: string;
  @IsNumber() count: number;
}

export class LineDto implements LineInput {
  @IsString() base: string;
  @IsString() size: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => AddOnDto) addOns: AddOnDto[];
  @IsNumber() quantity: number;
}

// Only the preset code is accepted: type/value come from the stored preset, never from the client.
export class DiscountInputDto {
  @IsString() presetCode: string;
}

export class PlaceOrderDto implements OrderInput {
  @IsArray() @ValidateNested({ each: true }) @Type(() => LineDto) lines: LineDto[];
  @IsOptional() @IsObject() @ValidateNested() @Type(() => DiscountInputDto) discount?: DiscountInputDto;
}
