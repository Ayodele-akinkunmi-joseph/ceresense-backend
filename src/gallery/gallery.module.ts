import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import { FileUploadService } from './file-upload.service';
import { Gallery } from './gallery.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Gallery]),
    MulterModule.register({
      dest: './uploads/gallery',
    }),
  ],
  controllers: [GalleryController],
  providers: [GalleryService, FileUploadService],
  exports: [GalleryService],
})
export class GalleryModule {}