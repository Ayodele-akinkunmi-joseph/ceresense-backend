import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { FilterBlogDto } from './dto/filter-blog.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/common/decorators/roles.decorator';
import { UserRole } from '../users/users.entity';
import { FileUploadService } from '../gallery/file-upload.service';

@ApiTags('Blog')
@Controller('blog')
export class BlogController {
  constructor(
    private readonly blogService: BlogService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @UseInterceptors(FileInterceptor('coverImage'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new blog post with cover image' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        excerpt: { type: 'string' },
        category: { type: 'string' },
        tags: { type: 'string' },
        readTime: { type: 'string' },
        isPublished: { type: 'boolean' },
        coverImage: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async create(
    @UploadedFile() file: Multer.File,
    @Body() createBlogDto: CreateBlogDto,
    @Request() req,
  ) {
    let coverImageUrl = null;

    // Handle file upload if provided
    if (file) {
      coverImageUrl = this.fileUploadService.getFileUrl(file.filename, 'blog');
    }

    // --- FIXED: Safely handle tags which might be a string or an array ---
    let tags = createBlogDto.tags;
    // Only process if tags exists and is a string
    if (tags && typeof tags === 'string') {
      try {
        // Try to parse as JSON first (in case it's a stringified array)
        tags = JSON.parse(tags);
      } catch {
        // If JSON parsing fails, treat it as a comma-separated string
        tags = tags.split(',').map(tag => tag.trim());
      }
    }
    // If tags is already an array, it's left untouched
    // -------------------------------------------------------------------

    // Create blog post with image URL
    const blogData = {
      ...createBlogDto,
      coverImage: coverImageUrl,
      tags, // This will now be either the original array or a parsed array
    };

    return this.blogService.create(blogData, req.user);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @UseInterceptors(FileInterceptor('coverImage'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update a blog post with optional new cover image' })
  async update(
    @Param('id') id: string,
    @UploadedFile() file: Multer.File,
    @Body() updateBlogDto: UpdateBlogDto,
    @Request() req,
  ) {
    let coverImageUrl = updateBlogDto.coverImage;

    // Handle new file upload if provided
    if (file) {
      coverImageUrl = this.fileUploadService.getFileUrl(file.filename, 'blog');
    }

    // --- FIXED: Safely handle tags which might be a string or an array ---
    let tags = updateBlogDto.tags;
    // Only process if tags exists and is a string
    if (tags && typeof tags === 'string') {
      try {
        // Try to parse as JSON first
        tags = JSON.parse(tags);
      } catch {
        // If JSON parsing fails, treat it as a comma-separated string
        tags = tags.split(',').map(tag => tag.trim());
      }
    }
    // If tags is already an array, it's left untouched
    // -------------------------------------------------------------------

    const updateData = {
      ...updateBlogDto,
      coverImage: coverImageUrl,
      tags,
    };

    return this.blogService.update(id, updateData, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all blog posts with filtering' })
  async findAll(@Query() filterDto: FilterBlogDto) {
    return this.blogService.findAll(filterDto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get blog statistics' })
  async getStats() {
    return this.blogService.getStats();
  }

  @Get('categories/stats')
  @ApiOperation({ summary: 'Get statistics by category' })
  async getCategoriesStats() {
    return this.blogService.getCategoriesStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a blog post by ID' })
  async findOne(@Param('id') id: string) {
    return this.blogService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiBearerAuth()
  async remove(@Param('id') id: string, @Request() req) {
    // Get the post to delete its cover image
    const post = await this.blogService.findOne(id);

    // Delete the cover image file if it exists
    if (post.coverImage) {
      const filename = post.coverImage.split('/').pop();
      if (filename) {
        this.fileUploadService.deleteFile(filename, 'blog');
      }
    }

    return this.blogService.remove(id, req.user);
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Like a blog post' })
  async likePost(@Param('id') id: string) {
    return this.blogService.incrementLikes(id);
  }
}
