import { Body, Controller, Get, HttpException, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/auth.decorators';
import type { NguoiDung } from '../auth/auth.types';
import { CauHinhService } from '../cau-hinh/cau-hinh.service';
import { lamSachLichSu, lamSachNguCanh, lamSachTinNhan } from './chatbot/an-toan';
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

  /**
   * Body: { message, history?: [{vai, text}], context? }. `context` là trạng thái hội thoại do chính server trả về ở lượt trước,
   * client chỉ việc gửi lại nguyên văn. Phản hồi gồm lời đáp, thẻ sản phẩm/đơn hàng và gợi ý nhanh.
   */
  @Post('chatbot/ask')
  async hoiChatbot(
    @Body() body: Record<string, unknown>,
    @CurrentUser() nguoiDung: NguoiDung | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const msg = lamSachTinNhan(body?.message);
    if (!msg) {
      return { success: false, reply: 'Vui lòng nhập câu hỏi của bạn.' };
    }
    if ([...msg].length > 500) {
      return { success: false, reply: 'Câu hỏi quá dài (tối đa 500 ký tự).' };
    }
    const xff = String(req.headers['x-forwarded-for'] ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    const khoa = nguoiDung ? `u:${nguoiDung.id}` : `ip:${xff[xff.length - 1] ?? req.ip ?? req.socket?.remoteAddress ?? '?'}`;
    const gh = this.chatbot.thuTanSuat(khoa);
    if (!gh.duoc) {
      res.setHeader('Retry-After', String(gh.thuLaiSau));
      throw new HttpException(`Bạn nhắn hơi nhanh, vui lòng thử lại sau ${gh.thuLaiSau} giây nhé.`, 429);
    }
    return this.chatbot.hoi({ message: msg, lichSu: lamSachLichSu(body?.history), nguCanh: lamSachNguCanh(body?.context) }, nguoiDung);
  }
}
