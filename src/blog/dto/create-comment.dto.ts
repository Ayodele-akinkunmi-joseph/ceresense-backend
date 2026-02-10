import { IsString, IsOptional } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  text: string;

  @IsString()
  @IsOptional()
  parentId?: string;
}