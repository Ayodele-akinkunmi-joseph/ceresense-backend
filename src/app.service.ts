import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRootMessage() {
    return '✅ CERESENSE Backend is LIVE!';
  }
}