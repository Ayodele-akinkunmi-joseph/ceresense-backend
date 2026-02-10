import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import type { Multer } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { GalleryService } from './gallery.service';
import { FileUploadService } from './file-upload.service';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { FilterGalleryDto } from './dto/filter-gallery.dto';
import { Gallery, GalleryStatus, GalleryCategory } from './gallery.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/common/decorators/roles.decorator';
import { UserRole } from '../users/users.entity';

@ApiTags('Gallery')
@Controller('gallery')
export class GalleryController {
  constructor(
    private readonly galleryService: GalleryService,
    private readonly fileUploadService: FileUploadService,
  ) {}

 @Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.EDITOR)
@UseInterceptors(FileInterceptor('image'))
@ApiBearerAuth()
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string', enum: Object.values(GalleryCategory) },
      tags: { type: 'string' }, // Comma-separated string
      featured: { type: 'boolean' },
      date: { type: 'string' },
      status: { type: 'string', enum: Object.values(GalleryStatus) },
      image: {
        type: 'string',
        format: 'binary',
      },
    },
  },
})
async create(
  @UploadedFile() file: Multer.File,
  @Body() createGalleryDto: CreateGalleryDto,
  @Request() req,
) {
  console.log('Received file:', file?.filename);
  console.log('Received DTO:', createGalleryDto);
  console.log('Tags type:', typeof createGalleryDto.tags, 'Value:', createGalleryDto.tags);
  console.log('Featured type:', typeof createGalleryDto.featured, 'Value:', createGalleryDto.featured);

  if (!file) {
    throw new BadRequestException('Image file is required');
  }

  // Log the raw body for debugging
  console.log('Raw tags:', createGalleryDto.tags);

  const imageUrl = this.fileUploadService.getFileUrl(file.filename);
  return this.galleryService.create(createGalleryDto, imageUrl, req.user);
}

  @Get()
  @ApiOperation({ summary: 'Get all gallery items with filtering' })
  async findAll(@Query() filterDto: FilterGalleryDto) {
    return this.galleryService.findAll(filterDto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get gallery statistics' })
  async getStats() {
    return this.galleryService.getStats();
  }

  @Get('categories/stats')
  @ApiOperation({ summary: 'Get statistics by category' })
  async getCategoriesStats() {
    return this.galleryService.getCategoriesStats();
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured gallery items' })
  async getFeatured() {
    return this.galleryService.getFeatured();
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Get gallery items by category' })
  async findByCategory(@Param('category') category: GalleryCategory) {
    return this.galleryService.findByCategory(category);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a gallery item by ID' })
  async findOne(@Param('id') id: string) {
    return this.galleryService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiBearerAuth()
  async update(
    @Param('id') id: string,
    @Body() updateGalleryDto: UpdateGalleryDto,
  ) {
    return this.galleryService.update(id, updateGalleryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async remove(@Param('id') id: string) {
    const gallery = await this.galleryService.findOne(id);
    const filename = gallery.imageUrl.split('/').pop();
    if (filename) {
      this.fileUploadService.deleteFile(filename);
    }
    
    return this.galleryService.remove(id);
  }

  @Put(':id/views')
  @ApiOperation({ summary: 'Increment view count' })
  async incrementViews(@Param('id') id: string) {
    return this.galleryService.incrementViews(id);
  }

  @Put(':id/downloads')
  @ApiOperation({ summary: 'Increment download count' })
  async incrementDownloads(@Param('id') id: string) {
    return this.galleryService.incrementDownloads(id);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiBearerAuth()
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: GalleryStatus,
  ) {
    return this.galleryService.updateStatus(id, status);
  }

  @Put(':id/featured')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiBearerAuth()
  async toggleFeatured(@Param('id') id: string) {
    return this.galleryService.toggleFeatured(id);
  }
}