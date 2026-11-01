import { Request } from 'express';

export interface NguoiDung {
  id: string;
  tenDangNhap: string;
  maQuyen: number;
}

export interface AuthRequest extends Request {
  user?: NguoiDung;
}
