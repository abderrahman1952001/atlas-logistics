import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export class CreateRequestDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) origin!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) destination!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(200) cargo!: string;
  @ApiProperty({ minimum: 1, maximum: 1000000 }) @IsInt() @Min(1) @Max(1000000) weightKg!: number;
  @ApiProperty({ format: 'date' }) @IsString() @Matches(datePattern) pickupDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class QuoteDto {
  @ApiProperty({ minimum: 1, maximum: 1000000000 })
  @IsInt()
  @Min(1)
  @Max(1000000000)
  amountDzd!: number;
  @ApiProperty({ minimum: 1, maximum: 365 }) @IsInt() @Min(1) @Max(365) estimatedDays!: number;
  @ApiProperty({ format: 'date' }) @IsString() @Matches(datePattern) validUntil!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class CompanyStatusDto {
  @ApiProperty({ enum: ['verified', 'suspended'] }) @IsIn(['verified', 'suspended']) status!:
    | 'verified'
    | 'suspended';
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class BookingStatusDto {
  @ApiProperty({ enum: ['in_transit', 'delivered', 'completed', 'cancelled'] })
  @IsIn(['in_transit', 'delivered', 'completed', 'cancelled'])
  status!: 'in_transit' | 'delivered' | 'completed' | 'cancelled';
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) @Max(2147483647) version!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
export class ReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) rating!: number;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(1000) comment!: string;
}
