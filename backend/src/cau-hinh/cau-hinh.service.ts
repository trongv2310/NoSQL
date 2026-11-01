import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CauHinh } from '../schemas';

export const LOGO_MAC_DINH = 'images/HUIT.jpg';

@Injectable()
export class CauHinhService {
  private cache = new Map<string, { v: string | null; het: number }>();

  constructor(@InjectModel(CauHinh.name) private readonly model: Model<CauHinh>) {}

  async get(khoa: string, macDinh: string | null = null): Promise<string | null> {
    const hit = this.cache.get(khoa);
    if (hit && hit.het > Date.now()) {
      return hit.v ?? macDinh;
    }
    const r = await this.model.findOne({ khoa }).lean();
    this.cache.set(khoa, { v: r?.giaTri ?? null, het: Date.now() + 60_000 });
    return r?.giaTri ?? macDinh;
  }

  async set(khoa: string, giaTri: string | null, moTa?: string): Promise<void> {
    this.cache.delete(khoa);
    await this.model.updateOne({ khoa }, { $set: { giaTri, ...(moTa ? { moTa } : {}) } }, { upsert: true });
  }

  async thongTinSite() {
    return {
      tenSite: (await this.get('site_name', 'Shop Cầu Lông')) as string,
      moTaSite: (await this.get('site_description', 'Cửa hàng dụng cụ và phụ kiện cầu lông chính hãng')) as string,
      logo: (await this.get('logo_url', LOGO_MAC_DINH)) || LOGO_MAC_DINH,
    };
  }
}
