import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

export type DuLieuMomo = Record<string, string | undefined>;

const TRUONG_CHU_KY = [
  'amount', 'extraData', 'message', 'orderId', 'orderInfo', 'orderType',
  'partnerCode', 'payType', 'requestId', 'responseTime', 'resultCode', 'transId',
] as const;

@Injectable()
export class MomoService {
  private readonly endpoint: string;
  private readonly partnerCode: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly returnUrl: string;
  private readonly notifyUrl: string;
  private readonly mock: boolean;
  private readonly frontendUrl: string;

  constructor(cfg: ConfigService) {
    this.endpoint = cfg.get('MOMO_ENDPOINT', 'https://test-payment.momo.vn/v2/gateway/api/create');
    this.partnerCode = cfg.get('MOMO_PARTNER_CODE', 'MOMO5RGX20191128');
    this.accessKey = cfg.get('MOMO_ACCESS_KEY', 'M8brj9K6E22vXoDB');
    this.secretKey = cfg.get('MOMO_SECRET_KEY', 'nqQiVSgDMy809JoPF6OzP5OdBUB550Y4');
    this.frontendUrl = cfg.get('FRONTEND_URL', 'http://localhost:3000');
    this.returnUrl = cfg.get('MOMO_RETURN_URL', `${this.frontendUrl}/DonHang/ThanhToanMomoSuccess`);
    this.notifyUrl = cfg.get('MOMO_NOTIFY_URL', 'http://localhost:4000/api/don-hang/momo/ipn');
    this.mock = cfg.get('MOMO_MOCK', 'true') !== 'false';
  }

  get laMock(): boolean {
    return this.mock;
  }

  get maDoiTac(): string {
    return this.partnerCode;
  }

  private ky(rawHash: string): string {
    return createHmac('sha256', this.secretKey).update(rawHash).digest('hex');
  }

  private rawHashPhanHoi(d: DuLieuMomo): string {
    return (
      `accessKey=${this.accessKey}` + TRUONG_CHU_KY.map((k) => `&${k}=${d[k] ?? ''}`).join('')
    );
  }

  /** Trả về URL thanh toán; ở chế độ mock là trang giả lập MoMo trên frontend. */
  async createPayment(soDonHang: number, amount: number, orderInfo = ''): Promise<string> {
    const orderId = String(soDonHang);
    if (this.mock) {
      return `${this.frontendUrl}/DonHang/MoMoMockGateway?orderId=${orderId}`;
    }
    const requestId = randomUUID();
    const amountInt = Math.trunc(amount);
    const info = orderInfo || `Thanh toan don hang #${soDonHang}`;
    const requestType = 'captureWallet';
    const raw =
      `accessKey=${this.accessKey}&amount=${amountInt}&extraData=&ipnUrl=${this.notifyUrl}` +
      `&orderId=${orderId}&orderInfo=${info}&partnerCode=${this.partnerCode}` +
      `&redirectUrl=${this.returnUrl}&requestId=${requestId}&requestType=${requestType}`;
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        partnerCode: this.partnerCode,
        partnerName: 'Shop Cầu Lông',
        storeId: 'MomoTestStore',
        requestId,
        amount: amountInt,
        orderId,
        orderInfo: info,
        redirectUrl: this.returnUrl,
        ipnUrl: this.notifyUrl,
        lang: 'vi',
        extraData: '',
        requestType,
        signature: this.ky(raw),
      }),
    });
    if (!res.ok) {
      throw new Error(`Lỗi kết nối cổng thanh toán MoMo: ${await res.text()}`);
    }
    const json = (await res.json()) as { payUrl?: string; message?: string; resultCode?: number };
    if (json.payUrl) {
      return json.payUrl;
    }
    let message = json.message ?? 'Lỗi không xác định';
    if (json.resultCode === 99) {
      message += ' (Tài khoản test mặc định của MoMo bị từ chối. Hãy bật MOMO_MOCK=true để chạy giả lập MoMo Sandbox, hoặc đăng ký Merchant riêng tại business.momo.vn)';
    }
    throw new Error(`MoMo không trả về đường dẫn thanh toán: ${message}`);
  }

  chuKyHopLe(d: DuLieuMomo): boolean {
    if (!d.signature || TRUONG_CHU_KY.some((k) => d[k] === undefined)) {
      return false;
    }
    const mong = Buffer.from(this.ky(this.rawHashPhanHoi(d)));
    const nhan = Buffer.from(String(d.signature));
    return mong.length === nhan.length && timingSafeEqual(mong, nhan);
  }

  taoKetQuaMock(soDonHang: number, amount: number, thanhCong: boolean): DuLieuMomo {
    const now = Date.now();
    const data: DuLieuMomo = {
      partnerCode: this.partnerCode,
      orderId: String(soDonHang),
      requestId: `MOCK_REQ_${Math.floor(now / 1000)}_${soDonHang}`,
      amount: String(Math.trunc(amount)),
      orderInfo: `Thanh toan don hang #${soDonHang}`,
      orderType: 'momo_wallet',
      transId: String(Math.floor(now / 1000)),
      resultCode: thanhCong ? '0' : '1006',
      message: thanhCong ? 'Giao dịch thành công.' : 'Giao dịch bị hủy bởi người dùng.',
      payType: 'qr',
      responseTime: String(now),
      extraData: '',
    };
    data.signature = this.ky(this.rawHashPhanHoi(data));
    return data;
  }
}
