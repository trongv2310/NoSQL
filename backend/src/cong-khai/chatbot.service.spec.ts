import { ConfigService } from '@nestjs/config';
import { duLieuMau, KM_10 } from '../../test/chatbot-mau';
import { lamSachNguCanh } from './chatbot/an-toan';
import { PhanHoiChatbot } from './chatbot/chatbot.types';
import { ChatbotService } from './chatbot.service';

/* eslint-disable @typescript-eslint/no-explicit-any */
const NGUOI_DUNG = { id: 'u'.padEnd(24, '1'), tenDangNhap: 'khach', maQuyen: 3 };

function taoService(opts: { key?: string; don?: any[]; coKhachHang?: boolean } = {}) {
  const { sanPhams, bienThes } = duLieuMau();
  const chuoi = (kq: any) => ({ populate: () => chuoi(kq), sort: () => chuoi(kq), limit: () => chuoi(kq), lean: async () => kq });
  const spModel = { find: () => chuoi(sanPhams) };
  const ctModel = { find: () => chuoi(bienThes) };
  const kmModel = { find: () => chuoi([KM_10]) };
  const phModel = { aggregate: async () => [] };
  const dhModel = {
    findOne: (f: any) => chuoi((opts.don ?? []).find((d) => d.soDonHang === f.soDonHang) ?? null),
    find: () => chuoi(opts.don ?? []),
  };
  const khModel = { findOne: () => chuoi(opts.coKhachHang === false ? null : { _id: 'kh1' }) };
  const cfg = { get: (k: string, def?: string) => (k === 'GEMINI_API_KEY' ? (opts.key ?? '') : def) } as unknown as ConfigService;
  const svc = new ChatbotService(cfg, spModel as any, ctModel as any, kmModel as any, phModel as any, dhModel as any, khModel as any);
  (svc as any).chamThuLaiMs = 0;
  return svc;
}

/** Mô phỏng cuộc trò chuyện: giữ `context` và lịch sử như giao diện thật. */
function phien(svc: ChatbotService, nguoiDung?: any) {
  let nguCanh = {};
  const lichSu: { vai: 'user' | 'bot'; text: string }[] = [];
  return async (message: string): Promise<PhanHoiChatbot> => {
    const r = await svc.hoi({ message, lichSu: lichSu.slice(), nguCanh: lamSachNguCanh(nguCanh) }, nguoiDung);
    nguCanh = r.context;
    lichSu.push({ vai: 'user', text: message }, { vai: 'bot', text: r.reply });
    return r;
  };
}

const geminiTraLoi = (text: string, extra: any = {}) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }], ...extra }) });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ChatbotService – chế độ tra cứu (không có GEMINI_API_KEY)', () => {
  it('tư vấn vợt theo trình độ + ngân sách, trả thẻ sản phẩm thật và gợi ý nhanh', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const chat = phien(taoService());
    const r = await chat('Tư vấn vợt cho người mới chơi, dưới 3,5 triệu');
    expect(r.success).toBe(true);
    expect(r.nguon).toBe('tra-cuu');
    expect(r.yDinh).toBe('tu_van');
    expect(r.products.length).toBeGreaterThan(0);
    expect(r.products[0].ten).toContain('Tectonic 7');
    expect(r.products.every((p) => p.gia <= 3_500_000 && p.conHang)).toBe(true);
    expect(r.products[0].link).toMatch(/^\/Home\/ChiTietSanPham\/[0-9a-f]{24}$/);
    expect(r.products[0].anh).toBe('anh.jpg');
    expect(r.reply).toContain('Tectonic 7');
    expect(r.quickReplies.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('giữ ngữ cảnh: ngân sách + lối chơi + "rẻ hơn"', async () => {
    const chat = phien(taoService());
    const r1 = await chat('tư vấn vợt dưới 4,5 triệu');
    expect(r1.context).toMatchObject({ loai: 'vot', giaMax: 4_500_000 });
    const r2 = await chat('thiên tấn công');
    expect(r2.context).toMatchObject({ loai: 'vot', loiChoi: 'cong', giaMax: 4_500_000 });
    expect(r2.reply).toContain('thiên tấn công');
    expect(r2.products[0].ten).toContain('Astrox 99');
    const r3 = await chat('rẻ hơn');
    expect(r3.products.length).toBeGreaterThan(0);
    expect(r3.products.every((p) => p.gia < r2.products[0].gia)).toBe(true);
    expect(r3.products[0].ten).toContain('Thruster');
  });

  it('giữ ngữ cảnh: "mẫu khác", "còn hàng không?", "cái thứ 2"', async () => {
    const chat = phien(taoService());
    const r1 = await chat('tư vấn vợt');
    const r2 = await chat('mẫu khác');
    const daThay = new Set(r1.products.map((p) => p.id));
    expect(r2.products.length).toBeGreaterThan(0);
    expect(r2.products.every((p) => !daThay.has(p.id))).toBe(true);

    const r3 = await chat('còn hàng không?');
    expect(r3.yDinh).toBe('ton_kho');
    expect(r3.products.map((p) => p.id)).toEqual(r2.products.map((p) => p.id));

    const r4 = await chat('mẫu thứ 1 giá bao nhiêu');
    expect(r4.yDinh).toBe('hoi_gia');
    expect(r4.products.map((p) => p.id)).toEqual([r2.products[0].id]);
  });

  it('đổi sang loại hàng khác thì không mang ngân sách/hãng của loại cũ', async () => {
    const chat = phien(taoService());
    await chat('vợt Yonex dưới 4 triệu');
    const r = await chat('còn giày thì sao');
    expect(r.context).toEqual(expect.objectContaining({ loai: 'giay' }));
    expect(r.context.hang).toBeUndefined();
    expect(r.context.giaMax).toBeUndefined();
  });

  it('hỏi giá và tồn kho theo tên model, hiểu size', async () => {
    const chat = phien(taoService());
    const gia = await chat('Astrox 99 Pro giá bao nhiêu');
    expect(gia.yDinh).toBe('hoi_gia');
    expect(gia.reply).toContain('4.190.000đ');
    const ton = await chat('còn size 4U không?');
    expect(ton.yDinh).toBe('ton_kho');
    expect(ton.reply).toMatch(/4U/);
    const giay = await chat('giày Yonex Aerus size 42 còn hàng không');
    expect(giay.reply).toMatch(/size 42.*hết hàng/);
  });

  it('khuyến mãi: chương trình đang chạy + sản phẩm giảm giá còn hàng, giá đã trừ', async () => {
    const r = await phien(taoService())('đang có khuyến mãi gì');
    expect(r.yDinh).toBe('khuyen_mai');
    expect(r.reply).toContain('Giảm 10%');
    expect(r.products.length).toBeGreaterThan(0);
    const thruster = r.products.find((p) => p.ten.includes('Thruster'))!;
    expect(thruster.gia).toBe(1_935_000);
    expect(thruster.giaGoc).toBe(2_150_000);
    expect(thruster.phanTramGiam).toBe(10);
  });

  it('chính sách chỉ nói điều có trong hệ thống, còn lại hướng dẫn liên hệ', async () => {
    const chat = phien(taoService());
    const tt = await chat('thanh toán bằng gì');
    expect(tt.reply).toMatch(/COD/);
    expect(tt.reply).toMatch(/MoMo/);
    const bh = await chat('bảo hành mấy tháng');
    expect(bh.reply).toMatch(/chưa có thông tin/);
    expect(bh.reply).toContain('0123456789');
    expect(bh.reply).not.toMatch(/\d+ tháng/);
  });

  it('không bịa: không tìm thấy thì nói không tìm thấy', async () => {
    const r = await phien(taoService())('túi vợt Victor dưới 100k');
    expect(r.products).toEqual([]);
    expect(r.reply).toMatch(/chưa tìm thấy/);
  });

  it('câu lạ trả lời lịch sự kèm gợi ý, không lỗi', async () => {
    const r = await phien(taoService())('hôm nay ăn gì');
    expect(r.success).toBe(true);
    expect(r.yDinh).toBe('khac');
    expect(r.quickReplies.length).toBeGreaterThan(0);
  });
});

describe('ChatbotService – đơn hàng', () => {
  const don = { soDonHang: 12, trangThai: 'Đang xử lý', ngayDat: new Date('2026-05-01'), tongTien: 2_000_000, tongTienSauGiam: 1_900_000, chiTiet: [{}, {}] };

  it('khách chưa đăng nhập được mời đăng nhập, không lộ dữ liệu đơn', async () => {
    const r = await phien(taoService({ don: [don] }))('đơn hàng #12 đến đâu rồi');
    expect(r.yDinh).toBe('don_hang');
    expect(r.donHang).toEqual([]);
    expect(r.lienKet).toEqual([{ nhan: 'Đăng nhập', href: '/TaiKhoan/DangNhap' }]);
    expect(r.reply).not.toContain('Đang xử lý');
  });

  it('đã đăng nhập: trả trạng thái đơn và cho phép hủy khi còn trong diện được hủy', async () => {
    const r = await phien(taoService({ don: [don] }), NGUOI_DUNG)('đơn hàng #12 đến đâu rồi');
    expect(r.donHang).toHaveLength(1);
    expect(r.donHang[0]).toMatchObject({ soDonHang: 12, trangThai: 'Đang xử lý', tongTien: 1_900_000, link: '/DonHang/Details/12' });
    expect(r.reply).toContain('Đang xử lý');
    expect(r.reply).toMatch(/hủy/);
  });

  it('đơn của người khác hoặc không tồn tại: báo không thấy', async () => {
    const r = await phien(taoService({ don: [] }), NGUOI_DUNG)('kiểm tra đơn #99');
    expect(r.donHang).toEqual([]);
    expect(r.reply).toMatch(/không thấy đơn #99/);
  });

  it('không nêu mã đơn: liệt kê vài đơn gần nhất', async () => {
    const r = await phien(taoService({ don: [don, { ...don, soDonHang: 13, trangThai: 'Đã hoàn thành' }] }), NGUOI_DUNG)('đơn hàng của tôi');
    expect(r.donHang.map((d) => d.soDonHang)).toEqual([12, 13]);
  });

  it('tài khoản chưa có hồ sơ khách hàng được thông báo rõ', async () => {
    const r = await phien(taoService({ coKhachHang: false }), NGUOI_DUNG)('đơn hàng của tôi');
    expect(r.reply).toMatch(/chưa có thông tin khách hàng/);
  });
});

describe('ChatbotService – Gemini', () => {
  it('có key: dùng lời đáp của AI nhưng vẫn kèm thẻ sản phẩm; gửi đủ ngữ cảnh và dữ liệu kho', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiTraLoi('Mình gợi ý **Vợt Cầu Lông Lining Tectonic 7** (3.200.000đ) vì thân vợt mềm vừa, dễ làm quen. Bạn thiên về tấn công hay phòng thủ?'));
    vi.stubGlobal('fetch', fetchMock);
    const chat = phien(taoService({ key: 'khoa-gia' }));
    await chat('xin chào');
    const r = await chat('tư vấn vợt cho người mới, tầm 3 triệu');
    expect(r.nguon).toBe('ai');
    expect(r.reply).toContain('Tectonic 7');
    expect(r.products.length).toBeGreaterThan(0);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('generateContent');
    expect(init.headers['x-goog-api-key']).toBe('khoa-gia');
    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toMatch(/Không bịa|không bịa/);
    const luot = body.contents;
    expect(luot[luot.length - 1].role).toBe('user');
    expect(luot[luot.length - 1].parts[0].text).toContain('Vợt Cầu Lông Lining Tectonic 7');
    expect(luot[luot.length - 1].parts[0].text).toContain('3.200.000đ');
    expect(luot[0].role).toBe('user');
    expect(luot.map((l: any) => l.role).every((v: string, i: number, a: string[]) => i === 0 || v !== a[i - 1])).toBe(true);
  });

  it('AI nêu giá không có trong kho thì bị loại, dùng lời đáp tra cứu', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiTraLoi('Mẫu **Tectonic 7** chỉ 1.999.000đ thôi bạn!')));
    const r = await phien(taoService({ key: 'k' }))('tư vấn vợt cho người mới');
    expect(r.nguon).toBe('tra-cuu');
    expect(r.reply).not.toContain('1.999.000');
    expect(r.reply).toContain('3.200.000đ');
  });

  it('lỗi 429 được thử lại một lần', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce(geminiTraLoi('Mình gợi ý **Tectonic 7** nhé.'));
    vi.stubGlobal('fetch', fetchMock);
    const r = await phien(taoService({ key: 'k' }))('tư vấn vợt cho người mới');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.nguon).toBe('ai');
  });

  it('Gemini lỗi/timeout: vẫn trả lời bằng tra cứu; lỗi liên tiếp thì tạm ngưng gọi AI', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    vi.stubGlobal('fetch', fetchMock);
    const chat = phien(taoService({ key: 'k' }));
    for (let i = 0; i < 3; i++) {
      const r = await chat('tư vấn vợt cho người mới');
      expect(r.success).toBe(true);
      expect(r.nguon).toBe('tra-cuu');
      expect(r.products.length).toBeGreaterThan(0);
    }
    const lanGoi = fetchMock.mock.calls.length;
    const r = await chat('tư vấn vợt cho người mới');
    expect(r.nguon).toBe('tra-cuu');
    expect(fetchMock.mock.calls.length).toBe(lanGoi);
  });

  it('khối bị chặn (SAFETY) hoặc rỗng thì dùng tra cứu', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) }));
    const r = await phien(taoService({ key: 'k' }))('tư vấn vợt cho người mới');
    expect(r.nguon).toBe('tra-cuu');
  });

  it('ý định chào hỏi/chính sách/đơn hàng không tốn lượt AI', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiTraLoi('x'));
    vi.stubGlobal('fetch', fetchMock);
    const chat = phien(taoService({ key: 'k' }));
    await chat('xin chào');
    await chat('thanh toán bằng gì');
    await chat('đơn hàng #1');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('ChatbotService – giới hạn tần suất', () => {
  it('chặn khi gửi quá nhanh theo từng khách', () => {
    const svc = taoService();
    const kq = Array.from({ length: 16 }, () => svc.thuTanSuat('ip:1.2.3.4'));
    expect(kq.slice(0, 15).every((k) => k.duoc)).toBe(true);
    expect(kq[15].duoc).toBe(false);
    expect(svc.thuTanSuat('ip:5.6.7.8').duoc).toBe(true);
  });
});

describe('ChatbotService – lỗi hệ thống', () => {
  it('không tải được kho thì báo bận (success=false), không ném lỗi', async () => {
    const svc = taoService();
    (svc as any).spModel = { find: () => { throw new Error('mongo down'); } };
    const r = await svc.hoi({ message: 'tư vấn vợt', lichSu: [], nguCanh: {} });
    expect(r.success).toBe(false);
    expect(r.reply).toMatch(/bận/);
  });
});
