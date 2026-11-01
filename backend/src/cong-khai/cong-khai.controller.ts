import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CauHinhService } from '../cau-hinh/cau-hinh.service';
import { ChatbotService } from './chatbot.service';
import { CongKhaiService } from './cong-khai.service';

/* eslint-disable @typescript-eslint/no-explicit-any */
@Controller()
export class CongKhaiController {
  constructor(
    private readonly congKhai: CongKhaiService,
    private readonly cauHinh: CauHinhService,
    private readonly chatbot: ChatbotService,
  ) {}

  @Get('landing')
  landing() {
    return this.congKhai.landing();
  }

  @Get('site')
  site() {
    return this.cauHinh.thongTinSite();
  }

  @Get('ban-tin')
  bangTin(@Query() q: Record<string, any>) {
    return this.congKhai.bangTin(q);
  }

  /** Mỗi người chỉ được cộng 1 lượt xem cho mỗi bài (theo cookie), thay cho session của Laravel. */
  @Get('ban-tin/:id')
  chiTietTin(@Param('id') id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const khoa = `da_xem_tin_${id}`;
    const daXem = !!req.cookies?.[khoa];
    if (!daXem) {
      res.cookie(khoa, '1', { httpOnly: true, sameSite: 'lax', maxAge: 24 * 3600 * 1000, path: '/' });
    }
    return this.congKhai.chiTietTin(id, daXem);
  }

  @Post('chatbot/ask')
  async hoiChatbot(@Body('message') message?: string) {
    const msg = String(message ?? '').trim();
    if (!msg) {
      return { success: false, reply: 'Vui lòng nhập câu hỏi của bạn.' };
    }
    if ([...msg].length > 500) {
      return { success: false, reply: 'Câu hỏi quá dài (tối đa 500 ký tự).' };
    }
    return this.chatbot.ask(msg);
  }
}
