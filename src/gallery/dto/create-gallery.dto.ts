import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { GalleryCategory, GalleryStatus } from '../gallery.entity';

export class CreateGalleryDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(GalleryCategory)
  @IsNotEmpty()
  category: GalleryCategory;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => {
    console.log('Tags value received:', value, 'Type:', typeof value);
    
    // If value is undefined or null, return empty array
    if (!value) return [];
    
    // If value is already an array, return it
    if (Array.isArray(value)) {
      console.log('Tags is already array:', value);
      return value;
    }
    
    // If value is a string
    if (typeof value === 'string') {
      try {
        // Try to parse as JSON
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          console.log('Parsed JSON array:', parsed);
          return parsed;
        }
      } catch (e) {
        console.log('Not JSON, trying comma separation');
        // If not JSON, split by comma
        const result = value
          .split(',')
          .map((tag: string) => tag.trim())
          .filter((tag: string) => tag.length > 0);
        console.log('Comma separated result:', result);
        return result;
      }
    }
    
    console.log('Returning empty array');
    return [];
  })
  tags?: string[];

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    console.log('Featured value received:', value, 'Type:', typeof value);
    
    if (value === 'true' || value === '1' || value === true) {
      return true;
    }
    if (value === 'false' || value === '0' || value === false) {
      return false;
    }
    return Boolean(value);
  })
  featured?: boolean;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsEnum(GalleryStatus)
  @IsOptional()
  status?: GalleryStatus;
}