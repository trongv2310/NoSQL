import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Regex tìm kiếm không phân biệt hoa/thường, tương đương LIKE %kw%. */
export function likeRegex(s: string): RegExp {
  return new RegExp(escapeRegex(s.trim()), 'i');
}

export function parseObjectId(id: string, label = 'ID'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException(`${label} không hợp lệ.`);
  }
  return new Types.ObjectId(id);
}

export interface Trang<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

export function phanTrang<T>(all: T[], page: number, perPage: number): Trang<T> {
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const p = Math.min(Math.max(1, page || 1), pages);
  return { items: all.slice((p - 1) * perPage, p * perPage), total, page: p, perPage, pages };
}

/**
 * Phân trang NGAY TRONG MongoDB: đếm bằng countDocuments rồi chỉ đọc đúng một trang bằng skip/limit,
 * thay vì tải hết rồi cắt trong bộ nhớ như phanTrang. Trang vượt quá số trang được kéo về trang cuối (giống phanTrang).
 * `docTrang(skip, limit)` nhận vị trí đã tính và trả các document của trang.
 */
export async function phanTrangDb<T>(
  dem: () => Promise<number>,
  docTrang: (skip: number, limit: number) => Promise<T[]>,
  page: number,
  perPage: number,
): Promise<Trang<T>> {
  const total = await dem();
  const pages = Math.max(1, Math.ceil(total / perPage));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const items = total ? await docTrang((p - 1) * perPage, perPage) : [];
  return { items, total, page: p, perPage, pages };
}

export function toBool(v: unknown): boolean {
  return v === true || v === 'true' || v === '1' || v === 1 || v === 'on';
}

export function homNayDauNgay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
