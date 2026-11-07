/**
 * Soạn lời đáp "tra cứu" (không cần AI) + gợi ý nhanh. Mọi con số/tên đều lấy từ kho, chính sách lấy từ cấu hình đã biết;
 * chỗ nào không có dữ liệu thì nói thẳng là chưa có và hướng khách liên hệ cửa hàng.
 */
import { TRANG_THAI } from '../../schemas';
import { khachCoTheHuy } from '../../don-hang/trang-thai';
import { SanPhamKho, TEN_LOAI } from './kho';
import { THONG_TIN_CUA_HANG as CH } from './chatbot.types';
import { ChuDeChinhSach, ChuDeHuongDan, NguCanh } from './nlu';

const TEN_NHOM = { cau: 'quả cầu', tui: 'túi vợt', cuon_can: 'quấn cán vợt' } as const;
import { dinhDangTien, KetQuaXepHang } from './xep-hang';

export const LOI_CHAO =
  'Xin chào! Mình là trợ lý ảo của Shop Cầu Lông. Mình có thể tư vấn vợt, giày, áo quần theo ngân sách và lối chơi, tra giá – tồn kho – khuyến mãi và kiểm tra đơn hàng của bạn. Bạn cần mình giúp gì ạ?';

export const GOI_Y_MO_DAU = ['Tư vấn vợt cho người mới', 'Giày cầu lông dưới 2 triệu', 'Đang có khuyến mãi gì?', 'Kiểm tra đơn hàng'];

function cumGia(c: NguCanh): string {
  if (c.giaTam !== undefined) return `tầm ${dinhDangTien(c.giaTam)}`;
  if (c.giaMin !== undefined && c.giaMax !== undefined) return `từ ${dinhDangTien(c.giaMin)} đến ${dinhDangTien(c.giaMax)}`;
  if (c.giaMax !== undefined) return `dưới ${dinhDangTien(c.giaMax % 1000 === 999 ? c.giaMax + 1 : c.giaMax)}`;
  if (c.giaMin !== undefined) return `từ ${dinhDangTien(c.giaMin)} trở lên`;
  return '';
}

/** Những gì đã ghi nhận được khi chưa đủ thông tin để lọc (chưa biết loại hàng). */
export function ghiNhanThongTin(c: NguCanh): string {
  const gia = cumGia(c);
  return [c.hang && `hãng ${c.hang}`, gia && `ngân sách ${gia}`].filter(Boolean).join(', ');
}

export function tomTatTieuChi(c: NguCanh): string {
  const p: string[] = [];
  p.push([c.nhom ? TEN_NHOM[c.nhom] : c.loai ? TEN_LOAI[c.loai] : 'sản phẩm', c.hang].filter(Boolean).join(' '));
  const gia = cumGia(c);
  if (gia) p.push(gia);
  if (c.kichCo) p.push(`size ${c.kichCo}`);
  if (c.trinhDo) p.push({ moi: 'cho người mới chơi', trung_binh: 'cho người chơi phong trào', nang_cao: 'cho người chơi nâng cao' }[c.trinhDo]);
  if (c.loiChoi) p.push({ cong: 'thiên tấn công', thu: 'thiên tốc độ, phòng thủ', toan_dien: 'công thủ toàn diện' }[c.loiChoi]);
  if (c.nheTay) p.push('nhẹ tay, đỡ mỏi cổ tay');
  if (c.sapXep === 're') p.push('giá mềm nhất');
  if (c.sapXep === 'cao') p.push('cao cấp nhất');
  return p.join(', ');
}

/** Câu hỏi làm rõ tiếp theo, chọn theo thông tin còn thiếu quan trọng nhất. */
export function cauHoiLamRo(c: NguCanh): { cau: string; chips: string[] } | null {
  if (!c.loai) {
    return { cau: 'Bạn đang quan tâm vợt, giày, áo quần hay phụ kiện ạ?', chips: ['Vợt cầu lông', 'Giày cầu lông', 'Áo quần', 'Phụ kiện'] };
  }
  if (c.loai === 'vot') {
    if (!c.trinhDo) return { cau: 'Bạn chơi cầu lông được bao lâu rồi (mới chơi, phong trào hay nâng cao)?', chips: ['Mới chơi', 'Chơi phong trào', 'Chơi nâng cao'] };
    if (!c.loiChoi) return { cau: 'Bạn thiên về tấn công (đập cầu) hay phòng thủ – phản tạt nhanh?', chips: ['Thiên tấn công', 'Thiên phòng thủ', 'Công thủ toàn diện'] };
  }
  if (c.giaMax === undefined && c.giaMin === undefined && !c.sapXep) {
    return { cau: 'Ngân sách bạn dự kiến khoảng bao nhiêu để mình lọc cho sát?', chips: c.loai === 'aoquan' || c.loai === 'phukien' ? ['Dưới 200 nghìn', '200 - 500 nghìn', 'Trên 500 nghìn'] : ['Dưới 2 triệu', '2 - 4 triệu', 'Trên 4 triệu'] };
  }
  return null;
}

export function goiYSauKetQua(c: NguCanh, coKetQua: boolean): string[] {
  const lamRo = cauHoiLamRo(c);
  if (!coKetQua) return lamRo ? lamRo.chips : ['Tư vấn vợt cho người mới', 'Đang có khuyến mãi gì?'];
  if (lamRo && lamRo.chips.length <= 3) return [...lamRo.chips, 'Mẫu khác'];
  if (lamRo) return lamRo.chips.slice(0, 3);
  return ['Rẻ hơn', 'Cao cấp hơn', 'Mẫu khác', 'Còn hàng không?'];
}

const GHI_CHU: Record<string, string> = {
  het_hang: 'Các mẫu phù hợp hiện đều đang tạm hết hàng, mình vẫn liệt kê để bạn tham khảo nhé.',
  het_mau_khac: 'Mình đã gợi ý hết các mẫu phù hợp với tiêu chí này rồi, đây là những mẫu nổi bật nhất để bạn xem lại.',
};

export function loiTuVan(c: NguCanh, kq: KetQuaXepHang): string {
  const tt = tomTatTieuChi(c);
  if (!kq.muc.length) {
    return `Mình chưa tìm thấy ${tt} nào trong kho. Bạn thử đổi ngân sách, hãng hoặc loại sản phẩm khác nhé.`;
  }
  const dong: string[] = [];
  const h = kq.ghiChu;
  if (h.includes('khong_co_hang')) dong.push(`Hiện shop chưa có ${c.loai ? TEN_LOAI[c.loai] : 'sản phẩm'} hãng ${c.hang}, mình gợi ý các hãng khác:`);
  else if (h.includes('ngoai_ngan_sach')) dong.push(`Hiện shop chưa có ${tt.split(',')[0]} nào đúng khoảng giá bạn nêu. Mình gợi ý các mẫu gần nhất:`);
  else if (h.includes('het_mau_trong_tam_gia')) dong.push(`Mình đã gợi ý hết các mẫu trong tầm giá này rồi. Nếu bạn linh hoạt ngân sách, đây là các mẫu gần nhất:`);
  else if (h.includes('khong_co_size')) dong.push(`Chưa có mẫu nào còn size ${c.kichCo}, mình gợi ý các mẫu gần đúng:`);
  else if (h.includes('bo_tu_khoa')) dong.push(`Mình không thấy đúng dòng bạn nhắc, nhưng có các mẫu ${tt} này:`);
  else dong.push(`Mình gợi ý ${kq.muc.length} mẫu ${tt}${kq.muc.every((m) => m.sp.tonKho > 0) ? ' (đang còn hàng)' : ''}:`);
  if (h.includes('het_hang')) dong.push(GHI_CHU.het_hang);
  if (h.includes('het_mau_khac')) dong.push(GHI_CHU.het_mau_khac);
  const dau = kq.muc[0];
  dong.push(`${h.includes('ngoai_ngan_sach') || h.includes('het_mau_trong_tam_gia') ? 'Gần nhất' : 'Phù hợp nhất'}: **${dau.sp.ten}** (${dau.sp.giaCao > dau.sp.gia ? 'từ ' : ''}${dinhDangTien(dau.sp.gia)})${dau.lyDo.length ? ` – ${dau.lyDo[0]}` : ''}. Chi tiết từng mẫu ở các thẻ bên dưới.`);
  if (kq.tongKhop > kq.muc.length && !h.includes('ngoai_ngan_sach')) dong.push(`(Còn ${kq.tongKhop - kq.muc.length} mẫu khác phù hợp – bấm "Mẫu khác" để xem thêm.)`);
  const lamRo = cauHoiLamRo(c);
  if (lamRo) dong.push('', lamRo.cau);
  return dong.join('\n');
}

export function loiKhongTimThay(c: NguCanh): string {
  return `Mình chưa tìm thấy ${tomTatTieuChi(c)} trong kho. Bạn có thể đổi ngân sách, hãng hoặc xem nhóm sản phẩm khác nhé.`;
}

// ---------------------------------------------------------------------------
// Tồn kho, giá
// ---------------------------------------------------------------------------

const hienTon = (n: number) => (n > 20 ? 'còn hàng (trên 20)' : n > 0 ? `còn ${n}` : 'hết hàng');

/** Gom tồn kho theo size (hoặc theo màu nếu sản phẩm không có size). */
export function nhomTonKho(sp: SanPhamKho): { ten: string; ton: number }[] {
  const coSize = sp.bienThe.some((b) => b.size);
  const m = new Map<string, number>();
  for (const b of sp.bienThe) {
    const k = (coSize ? b.size : b.mau) ?? 'Mặc định';
    m.set(k, (m.get(k) ?? 0) + b.ton);
  }
  return [...m].map(([ten, ton]) => ({ ten, ton }));
}

export function loiTonKho(sp: SanPhamKho, kichCo?: string): string {
  const nhom = nhomTonKho(sp);
  const coSize = sp.bienThe.some((b) => b.size);
  const dau = `**${sp.ten}**: ${sp.tonKho > 0 ? 'đang còn hàng' : 'hiện đã hết hàng'}.`;
  if (sp.tonKho === 0) return dau;
  if (kichCo) {
    const g = nhom.find((x) => x.ten.toLowerCase() === kichCo.toLowerCase());
    if (g) {
      return g.ton > 0
        ? `**${sp.ten}** size ${g.ten}: ${hienTon(g.ton)}.`
        : `**${sp.ten}** size ${g.ten} hiện hết hàng. Còn: ${nhom.filter((x) => x.ton > 0).map((x) => `${x.ten} (${hienTon(x.ton)})`).join(', ')}.`;
    }
  }
  const ct = nhom.map((x) => `${x.ten}: ${hienTon(x.ton)}`).join('; ');
  return `${dau} ${coSize ? 'Theo size' : 'Theo màu'} – ${ct}.`;
}

export function loiGia(sp: SanPhamKho): string {
  const khuyenMai = sp.phanTramGiam > 0 ? ` (giá gốc ${dinhDangTien(sp.giaGoc)}, đang giảm ${sp.phanTramGiam}%${sp.tenKhuyenMai ? ` – ${sp.tenKhuyenMai}` : ''})` : '';
  const nhieuGia = sp.giaCao > sp.gia ? ` Giá thay đổi theo biến thể, cao nhất ${dinhDangTien(sp.giaCao)}.` : '';
  return `**${sp.ten}** hiện có giá ${sp.giaCao > sp.gia ? 'từ ' : ''}**${dinhDangTien(sp.gia)}**${khuyenMai}.${nhieuGia} ${sp.tonKho > 0 ? 'Sản phẩm đang còn hàng.' : 'Sản phẩm hiện đã hết hàng.'}`;
}

// ---------------------------------------------------------------------------
// So sánh
// ---------------------------------------------------------------------------

export function loiSoSanh(ds: SanPhamKho[]): string {
  const dong = ds.map((sp) => {
    const ts = [sp.thongSo.canBang[0], sp.thongSo.doCung[0] && `thân ${sp.thongSo.doCung[0].toLowerCase()}`, sp.thongSo.trongLuong.length ? sp.thongSo.trongLuong.map((x) => x.split(' ')[0]).join('/') : ''].filter(Boolean).join(', ');
    return `• **${sp.ten}**: ${dinhDangTien(sp.gia)}${sp.phanTramGiam ? ` (giảm ${sp.phanTramGiam}%)` : ''}${ts ? ` · ${ts}` : ''}${sp.soDanhGia ? ` · ${sp.diem}/5 (${sp.soDanhGia} đánh giá)` : ''} · ${sp.tonKho > 0 ? 'còn hàng' : 'hết hàng'}`;
  });
  const re = [...ds].sort((a, b) => a.gia - b.gia);
  const ket = re[0].gia === re[re.length - 1].gia ? '' : `\nVề giá, **${re[0].ten}** mềm hơn ${dinhDangTien(re[re.length - 1].gia - re[0].gia)}.`;
  return `Mình so sánh nhanh giúp bạn:\n${dong.join('\n')}${ket}\nBạn cho mình biết lối chơi (tấn công hay phòng thủ) và trình độ để mình chọn giúp mẫu hợp nhất nhé.`;
}

// ---------------------------------------------------------------------------
// Khuyến mãi
// ---------------------------------------------------------------------------

const ngayVN = (d?: Date | string | null) => (d ? new Date(d).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');

export interface KhuyenMaiTin {
  tenChuongTrinh: string;
  phanTramGiam: number;
  giamToiDa?: number | null;
  ngayKetThuc?: Date | string | null;
  soSanPham?: number;
}

export function loiKhuyenMai(dsKm: KhuyenMaiTin[], coSanPham: boolean, tt: string): string {
  if (!dsKm.length && !coSanPham) return 'Hiện shop chưa có chương trình khuyến mãi nào đang chạy. Bạn quay lại sau hoặc theo dõi mục Khuyến mãi trên website nhé!';
  const dong: string[] = [];
  if (dsKm.length) {
    dong.push('Các chương trình khuyến mãi đang áp dụng:');
    dong.push(
      ...dsKm.map(
        (k) => `• **${k.tenChuongTrinh}** – giảm ${k.phanTramGiam}%${k.giamToiDa ? ` (tối đa ${dinhDangTien(k.giamToiDa)})` : ''}${k.soSanPham ? `, áp dụng ${k.soSanPham} sản phẩm còn hàng` : ''}${k.ngayKetThuc ? `, đến ${ngayVN(k.ngayKetThuc)}` : ''}`,
      ),
    );
  }
  dong.push(coSanPham ? `Dưới đây là những ${tt} đang giảm nhiều nhất (còn hàng):` : `Hiện chưa có ${tt} nào đang được giảm giá.`);
  return dong.join('\n');
}

// ---------------------------------------------------------------------------
// Chính sách, hướng dẫn, đơn hàng
// ---------------------------------------------------------------------------

const LIEN_HE = `${CH.ten} – ${CH.diaChi}. Điện thoại ${CH.dienThoai}, email ${CH.email}, mở cửa ${CH.gioMoCua}.`;

export function loiChinhSach(chuDe: ChuDeChinhSach, dsHang: string[]): string {
  switch (chuDe) {
    case 'dat_hang':
      return 'Bạn chỉ cần nhắn kiểu "Đặt hàng Astrox 99 Pro số lượng 2" (không nêu số lượng thì mình đặt 1). Mình sẽ thêm sản phẩm còn hàng vào giỏ rồi chuyển bạn tới trang thanh toán; bạn kiểm tra thông tin giao hàng và bấm xác nhận ở đó. Cần đăng nhập trước khi đặt.';
    case 'thanh_toan':
      return 'Khi đặt hàng, bạn có thể chọn một trong hai hình thức: thanh toán khi nhận hàng (COD) hoặc thanh toán online qua ví MoMo. Hiện mình chưa có thông tin về trả góp hay chuyển khoản trực tiếp.';
    case 'huy_don':
      return 'Bạn có thể tự hủy đơn ngay trong mục "Đơn hàng của tôi" khi đơn còn ở trạng thái Chờ xác nhận, Chờ thanh toán MoMo hoặc Đang xử lý. Đơn đang giao hoặc đã hoàn thành thì không tự hủy được, bạn vui lòng liên hệ cửa hàng:\n' + LIEN_HE;
    case 'cua_hang':
      return `Thông tin cửa hàng:\n• Địa chỉ: ${CH.diaChi}\n• Điện thoại: ${CH.dienThoai}\n• Email: ${CH.email}\n• Giờ mở cửa: ${CH.gioMoCua}`;
    case 'chinh_hang':
      return `Shop đang kinh doanh các hãng ${dsHang.join(', ') || 'cầu lông phổ biến'}. Mình chưa có tài liệu về chứng nhận nguồn gốc từng sản phẩm, bạn có thể ghé xem trực tiếp hoặc hỏi nhân viên:\n${LIEN_HE}`;
    case 'giao_hang':
    case 'bao_hanh':
    case 'doi_tra':
    case 'chung': {
      const ten = { giao_hang: 'phí và thời gian giao hàng', bao_hanh: 'chính sách bảo hành', doi_tra: 'chính sách đổi trả', chung: 'chính sách chi tiết' }[chuDe];
      return `Hiện hệ thống của mình chưa có thông tin ${ten} nên mình không muốn nói sai với bạn. Bạn vui lòng liên hệ cửa hàng để được xác nhận chính xác:\n${LIEN_HE}`;
    }
  }
}

export const CHIPS_CHINH_SACH = ['Thanh toán thế nào?', 'Làm sao hủy đơn?', 'Địa chỉ cửa hàng', 'Tư vấn vợt'];

export function loiHuongDan(chuDe: ChuDeHuongDan): string {
  switch (chuDe) {
    case 'trong_luong':
      return 'Ký hiệu **U** là trọng lượng vợt, U càng lớn vợt càng nhẹ: 3U ≈ 85–89g, 4U ≈ 80–84g, 5U ≈ 75–79g. Người mới hoặc tay yếu nên chọn 4U–5U; người chơi lâu năm, lực tay tốt có thể chọn 3U.';
    case 'can_bang':
      return 'Điểm cân bằng quyết định cảm giác vung vợt:\n• **Nặng đầu**: lực đập mạnh, hợp lối tấn công, đánh cầu sau (hơi nặng tay hơn).\n• **Nhẹ đầu**: vung nhanh, hợp phản tạt, phòng thủ, đánh đôi ở lưới.\n• **Cân bằng**: công thủ đều, dễ làm quen.';
    case 'do_cung':
      return 'Độ cứng thân vợt: thân **cứng** cho phản hồi nhanh, kiểm soát chính xác nhưng cần lực tay và kỹ thuật tốt; thân **trung bình/dẻo** trợ lực tốt, dễ đưa cầu nên hợp người mới và người chơi phong trào.';
    case 'suc_cang':
      return 'Sức căng (ví dụ 20–28 lbs) là mức căng cước tối đa khuyến nghị của khung vợt. Người mới nên căng ở mức thấp đến trung bình trong khoảng này để dễ trợ lực và bảo vệ khung vợt.';
    case 'chon_giay':
      return 'Khi chọn giày cầu lông, bạn nên đo chiều dài bàn chân rồi chọn size dư khoảng 0,5–1cm, ưu tiên đế chống trượt, êm và ôm chân để di chuyển tốt. Bạn cho mình biết size và ngân sách để mình lọc mẫu còn hàng nhé.';
    default:
      return 'Để chọn vợt phù hợp, bạn cân nhắc 4 điều: **trình độ** (mới chơi nên chọn thân dẻo/trung bình, 4U–5U), **lối chơi** (tấn công chọn nặng đầu, phản tạt chọn nhẹ đầu, công thủ đều chọn cân bằng), **trọng lượng** và **ngân sách**. Bạn cho mình biết những thông tin này, mình sẽ lọc mẫu còn hàng cho bạn.';
  }
}

export const CHIPS_HUONG_DAN = ['Tư vấn vợt cho người mới', 'Vợt thiên tấn công', 'Vợt nhẹ đầu'];

const GIAI_THICH_TRANG_THAI: Record<string, string> = {
  [TRANG_THAI.ChoXacNhan]: 'Cửa hàng đang chờ xác nhận đơn.',
  [TRANG_THAI.ChoThanhToanMomo]: 'Đơn đang chờ bạn hoàn tất thanh toán qua MoMo.',
  [TRANG_THAI.DaThanhToanMomo]: 'Shop đã nhận thanh toán MoMo và sẽ chuẩn bị hàng để giao.',
  [TRANG_THAI.DangXuLy]: 'Cửa hàng đang chuẩn bị hàng cho bạn.',
  [TRANG_THAI.DangGiao]: 'Đơn đang trên đường giao đến bạn.',
  [TRANG_THAI.HoanThanh]: 'Đơn đã giao thành công.',
  [TRANG_THAI.DaHuy]: 'Đơn đã bị hủy.',
  [TRANG_THAI.DaHuyThanhToanThatBai]: 'Đơn đã bị hủy do thanh toán MoMo không thành công.',
};

export interface DonTin {
  soDonHang: number;
  trangThai: string;
  ngayDat: Date | string;
  tongTienSauGiam: number;
  tongTien: number;
  soDong: number;
}

export const tienDon = (d: DonTin) => (d.tongTienSauGiam > 0 ? d.tongTienSauGiam : d.tongTien);

export function loiMotDon(d: DonTin): string {
  const huy = khachCoTheHuy(d.trangThai) ? ' Bạn vẫn có thể tự hủy đơn này trong mục "Đơn hàng của tôi".' : '';
  return `Đơn **#${d.soDonHang}** đặt ngày ${ngayVN(d.ngayDat)}, tổng ${dinhDangTien(tienDon(d))}: trạng thái **${d.trangThai}**. ${GIAI_THICH_TRANG_THAI[d.trangThai] ?? ''}${huy}`.trim();
}

export function loiNhieuDon(ds: DonTin[]): string {
  return `Đây là ${ds.length} đơn gần nhất của bạn:\n${ds.map((d) => `• **#${d.soDonHang}** (${ngayVN(d.ngayDat)}) – ${d.trangThai}, ${dinhDangTien(tienDon(d))}`).join('\n')}\nBấm vào đơn bên dưới để xem chi tiết.`;
}

export const LOI_CAN_DANG_NHAP = 'Để xem trạng thái đơn hàng, bạn vui lòng đăng nhập vào tài khoản đã đặt hàng rồi nhắn lại cho mình nhé. Mình chỉ hiển thị đơn của chính tài khoản đang đăng nhập để bảo mật thông tin.';

export const LOI_CAM_ON = 'Rất vui được hỗ trợ bạn! Nếu cần tư vấn thêm sản phẩm hay kiểm tra đơn hàng, cứ nhắn mình nhé.';
export const LOI_TAM_BIET = 'Cảm ơn bạn đã ghé Shop Cầu Lông. Chúc bạn chơi cầu thật vui và hẹn gặp lại!';
export const LOI_TRO_GIUP = 'Mình có thể: tư vấn vợt/giày/áo quần theo ngân sách, trình độ và lối chơi; tra giá và tồn kho từng mẫu; so sánh hai sản phẩm; báo khuyến mãi đang chạy; kiểm tra đơn hàng (cần đăng nhập) và giải đáp thanh toán, hủy đơn, thông tin cửa hàng.';
export const LOI_KHONG_HIEU = 'Mình chưa hiểu rõ ý bạn. Bạn có thể cho mình biết loại sản phẩm (vợt, giày, áo quần), ngân sách hoặc điều bạn muốn hỏi (giá, còn hàng, khuyến mãi, đơn hàng) không?';
