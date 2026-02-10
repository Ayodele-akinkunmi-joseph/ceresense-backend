// src/blog/blog.controller.ts
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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { FilterBlogDto } from './dto/filter-blog.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/common/decorators/roles.decorator';
import { UserRole } from '../users/users.entity';

@ApiTags('Blog')
@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new blog post' })
  async create(@Body() createBlogDto: CreateBlogDto, @Request() req) {
    return this.blogService.create(createBlogDto, req.user);
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

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiBearerAuth()
  async update(
    @Param('id') id: string,
    @Body() updateBlogDto: UpdateBlogDto,
    @Request() req,
  ) {
    return this.blogService.update(id, updateBlogDto, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiBearerAuth()
  async remove(@Param('id') id: string, @Request() req) {
    return this.blogService.remove(id, req.user);
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Like a blog post' })
  async likePost(@Param('id') id: string) {
    return this.blogService.incrementLikes(id);
  }

  // Comments Endpoints
  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a comment to a blog post' })
  async createComment(
    @Param('id') postId: string,
    @Body() createCommentDto: CreateCommentDto,
    @Request() req,
  ) {
    return this.blogService.createComment(postId, createCommentDto, req.user);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get comments for a blog post' })
  async getComments(@Param('id') postId: string) {
    return this.blogService.getComments(postId);
  }

  @Post('comments/:id/like')
  @ApiOperation({ summary: 'Like a comment' })
  async likeComment(@Param('id') commentId: string) {
    return this.blogService.likeComment(commentId);
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async deleteComment(@Param('id') commentId: string, @Request() req) {
    return this.blogService.deleteComment(commentId, req.user);
  }
}