import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { BlogPost } from './blog.entity';
import { FileUploadService } from '../gallery/file-upload.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BlogPost]),
    MulterModule.register({
      dest: './uploads/blog', // Separate folder for blog images
    }),
  ],
  controllers: [BlogController],
  providers: [BlogService, FileUploadService],
  exports: [BlogService],
})
export class BlogModule {}
