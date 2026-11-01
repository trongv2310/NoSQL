import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { DangKyDto, DangNhapDto, DoiMatKhauDto } from './auth.dto';
import { GioHang, KhachHang, Quyen, TaiKhoan, TaiKhoanDocument } from '../schemas';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(TaiKhoan.name) private readonly taiKhoanModel: Model<TaiKhoan>,
    @InjectModel(KhachHang.name) private readonly khachHangModel: Model<KhachHang>,
    @InjectModel(GioHang.name) private readonly gioHangModel: Model<GioHang>,
    private readonly jwt: JwtService,
  ) {}

  taoToken(tk: TaiKhoanDocument): string {
    return this.jwt.sign({ sub: String(tk._id), tenDangNhap: tk.tenDangNhap, maQuyen: tk.maQuyen });
  }

  /** Kiểm tra mật khẩu; tài khoản cũ lưu plaintext sẽ được băm lại ngay lần đăng nhập đầu. */
  private async kiemTraMatKhau(tk: TaiKhoanDocument, matKhau: string): Promise<boolean> {
    if (await bcrypt.compare(matKhau, tk.matKhau).catch(() => false)) {
      return true;
    }
    if (tk.matKhau === matKhau) {
      tk.matKhau = await bcrypt.hash(matKhau, 10);
      await tk.save();
      return true;
    }
    return false;
  }

  private async layNguoiDung(tk: TaiKhoanDocument) {
    const kh = await this.khachHangModel.findOne({ taiKhoan: tk._id }).lean();
    const soGio = kh ? await this.tongSoLuongGio(String(kh._id)) : 0;
    return {
      id: String(tk._id),
      tenDangNhap: tk.tenDangNhap,
      email: tk.email,
      maQuyen: tk.maQuyen,
      hoTen: kh?.hoTen ?? tk.tenDangNhap,
      khachHangId: kh ? String(kh._id) : null,
      gioHangCount: soGio,
    };
  }

  private async tongSoLuongGio(khachHangId: string): Promise<number> {
    const r = await this.gioHangModel.aggregate<{ t: number }>([
      { $match: { khachHang: new Types.ObjectId(khachHangId) } },
      { $group: { _id: null, t: { $sum: '$soLuong' } } },
    ]);
    return r[0]?.t ?? 0;
  }

  async dangNhap(dto: DangNhapDto, quanTri: boolean) {
    const tk = await this.taiKhoanModel.findOne({ tenDangNhap: dto.tenDangNhap.trim() });
    if (!tk || !(await this.kiemTraMatKhau(tk, dto.matKhau))) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.');
    }
    const coQuyenQuanTri = tk.maQuyen === Quyen.Admin || tk.maQuyen === Quyen.NhanVien;
    if (quanTri && !coQuyenQuanTri) {
      throw new UnauthorizedException('Tài khoản không có quyền truy cập vào trang quản trị.');
    }
    if (!quanTri && tk.maQuyen === Quyen.Admin) {
      throw new UnauthorizedException('Tài khoản Quản trị viên vui lòng đăng nhập tại trang quản trị (/admin).');
    }
    return { token: this.taoToken(tk), user: await this.layNguoiDung(tk) };
  }

  async dangKy(dto: DangKyDto) {
    if (dto.matKhau !== dto.xacNhanMatKhau) {
      throw new BadRequestException('Xác nhận mật khẩu không khớp.');
    }
    if (await this.taiKhoanModel.exists({ tenDangNhap: dto.tenDangNhap })) {
      throw new ConflictException('Tên đăng nhập đã tồn tại.');
    }
    if (
      (await this.taiKhoanModel.exists({ email: dto.email })) ||
      (await this.khachHangModel.exists({ email: dto.email }))
    ) {
      throw new ConflictException('Email đã được sử dụng.');
    }
    const tk = await this.taiKhoanModel.create({
      tenDangNhap: dto.tenDangNhap,
      matKhau: await bcrypt.hash(dto.matKhau, 10),
      email: dto.email,
      maQuyen: Quyen.KhachHang,
    });
    try {
      await this.khachHangModel.create({
        hoTen: dto.hoTen,
        email: dto.email,
        soDienThoai: dto.soDienThoai ?? '',
        diaChi: dto.diaChi ?? '',
        taiKhoan: tk._id,
      });
    } catch (e) {
      await this.taiKhoanModel.deleteOne({ _id: tk._id });
      throw new BadRequestException(`Lỗi khi tạo tài khoản: ${(e as Error).message}`);
    }
    return { token: this.taoToken(tk), user: await this.layNguoiDung(tk) };
  }

  async thongTinHienTai(id: string) {
    const tk = await this.taiKhoanModel.findById(id);
    if (!tk) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hợp lệ.');
    }
    return this.layNguoiDung(tk);
  }

  async thongTinKhachHang(id: string) {
    const kh = await this.khachHangModel.findOne({ taiKhoan: id }).lean();
    if (!kh) {
      throw new BadRequestException('Tài khoản của bạn là quản trị, không có thông tin khách hàng.');
    }
    return kh;
  }

  async doiMatKhau(id: string, dto: DoiMatKhauDto) {
    if (dto.matKhauMoi !== dto.xacNhanMoi) {
      throw new BadRequestException('Mật khẩu mới không khớp.');
    }
    if (dto.matKhauMoi === dto.matKhauCu) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu cũ.');
    }
    const tk = await this.taiKhoanModel.findById(id);
    if (!tk || !(await this.kiemTraMatKhau(tk, dto.matKhauCu))) {
      throw new BadRequestException('Mật khẩu cũ không chính xác.');
    }
    tk.matKhau = await bcrypt.hash(dto.matKhauMoi, 10);
    await tk.save();
  }
}
