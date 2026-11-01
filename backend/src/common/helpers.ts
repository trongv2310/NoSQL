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

export function toBool(v: unknown): boolean {
  return v === true || v === 'true' || v === '1' || v === 1 || v === 'on';
}

export function homNayDauNgay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
