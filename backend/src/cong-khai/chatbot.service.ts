import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { likeRegex } from '../common/helpers';
import { giaSauKhuyenMai, khuyenMaiConHieuLuc } from '../common/pricing';
import { ChiTietSanPham, KhuyenMai, SanPham } from '../schemas';

/* eslint-disable @typescript-eslint/no-explicit-any */
const TU_DUNG = ['dưới', 'trên', 'triệu', 'tr', 'đồng', 'muốn', 'tìm', 'mua', 'cần', 'cho', 'tôi', 'mình', 'có', 'không', 'vợt', 'giá'];
const dinhDangTien = (n: number) => Math.round(n).toLocaleString('vi-VN');

/** Chatbot tư vấn: tra cứu kho rồi (nếu có GEMINI_API_KEY) nhờ Gemini diễn đạt lại. */
@Injectable()
export class ChatbotService {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    cfg: ConfigService,
    @InjectModel(SanPham.name) private readonly spModel: Model<SanPham>,
    @InjectModel(ChiTietSanPham.name) private readonly ctModel: Model<ChiTietSanPham>,
    @InjectModel(KhuyenMai.name) private readonly kmModel: Model<KhuyenMai>,
  ) {
    this.apiKey = cfg.get<string>('GEMINI_API_KEY', '');
    this.model = cfg.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
  }

  private async goiGemini(prompt: string, timeoutMs: number): Promise<string | null> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = (await res.json()) as any;
    return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  }

  async ask(message: string): Promise<{ success: boolean; reply: string }> {
    try {
      const lower = message.trim().toLocaleLowerCase('vi');
      let maxPrice: number | null = null;
      const m = lower.match(/(dưới|tầm|khoảng)\s*(\d+(?:\.\d+)?)\s*(triệu|tr)/u);
      if (m) {
        maxPrice = parseFloat(m[2]) * 1_000_000;
      }
      const filter: Record<string, any> = { deletedAt: null };
      if (maxPrice !== null) {
        filter.giaGoc = { $lte: maxPrice };
      }
      const keywords = lower.split(/\s+/u).filter((w) => w && !TU_DUNG.includes(w) && isNaN(Number(w)));
      if (keywords.length) {
        filter.$or = keywords.map((k) => ({ tenSanPham: likeRegex(k) }));
      }
      const products: any[] = await this.spModel.find(filter).populate('khuyenMai').limit(5).lean();
      const ton = await this.ctModel.aggregate<{ _id: any; t: number }>([
        { $match: { sanPham: { $in: products.map((p) => p._id) } } },
        { $group: { _id: '$sanPham', t: { $sum: '$soLuongTon' } } },
      ]);
      const tonMap = new Map(ton.map((x) => [String(x._id), x.t]));

      let promoInfo = '';
      if (['khuyến mãi', 'giảm giá', 'sale'].some((k) => lower.includes(k))) {
        const kms = (await this.kmModel.find().lean()).filter((k) => khuyenMaiConHieuLuc(k));
        if (kms.length) {
          promoInfo = 'Chương trình khuyến mãi hiện có: ' + kms.map((k) => `${k.tenChuongTrinh} giảm ${k.phanTramGiam}%`).join(', ');
        }
      }

      let context = 'Hệ thống không tìm thấy sản phẩm nào khớp hoàn toàn với tiêu chí lọc.';
      if (products.length) {
        context = `Dữ liệu sản phẩm ${maxPrice ? 'dưới ' + dinhDangTien(maxPrice) + ' VNĐ' : ''} tìm thấy trong kho:\n`;
        for (const p of products) {
          context += `- ${p.tenSanPham}: Giá ${dinhDangTien(giaSauKhuyenMai(p.giaGoc, p.khuyenMai))} VNĐ (Tồn kho: ${tonMap.get(String(p._id)) ?? 0})\n`;
        }
      }
      if (promoInfo) {
        context += `\n${promoInfo}`;
      }
      const phuongAnDuPhong = { success: true, reply: `Dưới đây là một số gợi ý cho bạn:\n${context}` };
      if (!this.apiKey) {
        return phuongAnDuPhong;
      }
      const prompt =
        'Bạn là trợ lý ảo tư vấn bán thiết bị cầu lông thông minh, lịch sự, chuyên nghiệp của Shop Cầu Lông.\n' +
        `Dưới đây là dữ liệu thực tế từ hệ thống kho hàng:\n${context}\n\n` +
        'Hãy trả lời câu hỏi sau của khách hàng bằng tiếng Việt một cách tự nhiên, súc tích, tư vấn cụ thể tên sản phẩm, giá bán và tình trạng còn hàng:\n' +
        `Khách hàng: ${message}`;
      try {
        const text = await this.goiGemini(prompt, 20000);
        return { success: true, reply: text ?? 'Xin lỗi, tôi chưa thể trả lời câu hỏi này.' };
      } catch {
        return phuongAnDuPhong;
      }
    } catch (e) {
      return { success: false, reply: `Lỗi kết nối AI: ${(e as Error).message}` };
    }
  }

  async generateArticle(topic: string, summary?: string | null) {
    topic = topic.trim() || 'Kỹ thuật chơi cầu lông và hướng dẫn chọn vợt phù hợp';
    const tomTat = summary || `Tổng quan chi tiết và hướng dẫn chuyên sâu về chủ đề: ${topic}.`;
    const mau =
      `<p>Cầu lông là một trong những bộ môn thể thao được yêu thích nhất hiện nay nhờ tính linh hoạt, tốc độ và khả năng rèn luyện phản xạ tuyệt vời. Trong bài viết này, chúng tôi sẽ cùng bạn khám phá chi tiết về <strong>${topic}</strong>.</p>` +
      '<h3>1. Những điểm nổi bật và phân tích chuyên sâu</h3><p>Khi tìm hiểu về bộ môn cũng như các trang thiết bị thi đấu, người chơi cần lưu ý đến sự cân bằng giữa sức mạnh, độ chính xác và độ bền.</p>' +
      '<ul><li><strong>Độ trợ lực tối ưu:</strong> Thân vợt dẻo hoặc cứng trung bình hỗ trợ dễ dàng các pha phông cầu cuối sân.</li><li><strong>Cảm giác kiểm soát:</strong> Khung vát khí động học giúp tăng tốc độ vung vợt.</li><li><strong>Độ bền bỉ:</strong> Vật liệu Carbon cao cấp tăng sức chịu lực và độ căng cước.</li></ul>' +
      '<h3>2. Lời khuyên từ chuyên gia</h3><p>Hãy dành ít nhất 15 phút khởi động kỹ các khớp trước mỗi buổi tập, kết hợp nghỉ ngơi và dinh dưỡng hợp lý.</p>';
    if (!this.apiKey) {
      return { success: true, title: topic, summary: tomTat, content: mau };
    }
    try {
      const prompt =
        'Bạn là biên tập viên thể thao và chuyên gia cầu lông của website Shop Cầu Lông.\n' +
        `Hãy viết một bài viết tin tức hoặc chia sẻ kinh nghiệm hoàn chỉnh về chủ đề: "${topic}".` +
        (summary ? ` Dựa trên tóm tắt ban đầu: "${summary}".` : '') +
        '\n\nYêu cầu:\n- Định dạng trả về: chuỗi HTML chuẩn cho rich text editor (chỉ gồm các thẻ <p>, <h3>, <strong>, <em>, <ul>, <li>, <blockquote>).\n' +
        '- Độ dài khoảng 300 - 500 từ, hành văn cuốn hút, chuyên nghiệp, mạch lạc.\n- KHÔNG bao bọc bằng ```html ... ```, chỉ trả về mã HTML trực tiếp.';
      const text = (await this.goiGemini(prompt, 25000)) ?? '';
      const html = text.trim().replace(/^```(?:html)?\s*|\s*```$/gi, '');
      return { success: true, title: topic, summary: tomTat, content: html || mau };
    } catch (e) {
      return {
        success: true,
        title: topic,
        summary: tomTat,
        content: `<p>Nội dung giới thiệu chi tiết về <strong>${topic}</strong>. Hiện tại hệ thống đang cập nhật thêm dữ liệu chuyên sâu.</p>`,
        warning: `AI fallback: ${(e as Error).message}`,
      };
    }
  }
}
