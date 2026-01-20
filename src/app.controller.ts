import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot() {
    return {
      message: '✅ CERESENSE Backend is LIVE!',
      status: 'running',
      timestamp: new Date().toISOString(),
      endpoints: {
        auth: {
          register: 'POST /auth/register',
          login: 'POST /auth/login',
          forgotPassword: 'POST /auth/forgot-password',
          resetPassword: 'POST /auth/reset-password'
        }
      },
      note: 'Use POST requests with JSON body for auth endpoints'
    };
  }
}