"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { vnd } from "@/lib/format";
import {
  KINH_NGHIEM, LOI_CHOI, NGAN_SACH_VOT, goiYVot, lienKetVotTheoGia, votTrongTamGia,
  type KinhNghiem, type LoiChoi, type NganSachVot,
} from "@/lib/landing-data";
import { ghiNhoAnhBam } from "@/lib/morph";
import { useCatalog } from "./CatalogProvider";
import { fontTieuDe } from "./fonts";
import { docLuaChon, ghiLuaChon } from "./luu-lua-chon";
import { ProductImage } from "./ProductImage";
import { useScrollVar } from "./useScrollVar";
import { RvHeading } from "./Words";
import s from "./picker.module.css";

const CAU_HOI = ["Bạn định chi bao nhiêu?", "Bạn chơi cầu lông được bao lâu?", "Bạn thích đánh theo kiểu nào?"] as const;
const NHAN_BUOC = ["Ngân sách", "Kinh nghiệm", "Lối chơi"] as const;

/** Bộ chọn vợt ba bước. Mọi gợi ý đối chiếu thông số có trong kho (xem `goiYVot`), không tự suy diễn thêm. */
export function RacketPicker() {
  const kho = useCatalog();
  const [buoc, setBuoc] = useState(0); // 0–2: câu hỏi, 3: kết quả
  const [nsKhoa, setNsKhoa] = useState<NganSachVot["khoa"] | null>(null);
  const [knKhoa, setKnKhoa] = useState<KinhNghiem | null>(null);
  const [lcKhoa, setLcKhoa] = useState<LoiChoi | null>(null);
  const tieuDe = useRef<HTMLHeadingElement>(null);
  const khung = useRef<HTMLElement>(null);
  useScrollVar(khung, "pass");
  const daVaoBuoc = useRef(false);

  const [daKhoiPhuc, setDaKhoiPhuc] = useState(false);
  // Quay lại từ trang chi tiết vẫn thấy kết quả đã chọn (đọc sau hydrate để không lệch HTML của server).
  useEffect(() => {
    const r = docLuaChon<{ ns: NganSachVot["khoa"] | null; kn: KinhNghiem | null; lc: LoiChoi | null; buoc: number }>("landing:picker");
    if (r) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNsKhoa(r.ns); setKnKhoa(r.kn); setLcKhoa(r.lc); setBuoc(r.buoc);
    }
    setDaKhoiPhuc(true);
  }, []);
  useEffect(() => { if (daKhoiPhuc) ghiLuaChon("landing:picker", { ns: nsKhoa, kn: knKhoa, lc: lcKhoa, buoc }); }, [daKhoiPhuc, nsKhoa, knKhoa, lcKhoa, buoc]);

  // Chuyển bước thì đưa focus về tiêu đề bước mới (người dùng bàn phím/đọc màn hình không bị bỏ lại ở nút cũ).
  useEffect(() => {
    if (!daVaoBuoc.current) { daVaoBuoc.current = true; return; }
    tieuDe.current?.focus({ preventScroll: true });
  }, [buoc]);

  const ns = NGAN_SACH_VOT.find((n) => n.khoa === nsKhoa) ?? null;
  const dem = useMemo(() => NGAN_SACH_VOT.map((n) => votTrongTamGia(kho.items, n).length), [kho.items]);
  const ketQua = useMemo(
    () => (ns && knKhoa && lcKhoa ? goiYVot(kho.items, ns, knKhoa, lcKhoa) : null),
    [kho.items, ns, knKhoa, lcKhoa],
  );
  const coDuLieu = kho.trangThai === "ok" && dem.some((n) => n > 0);

  /** Ghi lựa chọn rồi sang bước kế; nếu đã đủ ba câu trả lời (đang sửa một câu) thì về thẳng kết quả. */
  const chon = (viTri: number, ghi: () => void, daDuCauKhac: boolean) => {
    ghi();
    setBuoc(daDuCauKhac ? 3 : viTri + 1);
  };
  const daChon = [ns?.nhan, KINH_NGHIEM.find((k) => k.khoa === knKhoa)?.nhan, LOI_CHOI.find((l) => l.khoa === lcKhoa)?.nhan];
  const lamLai = () => { setNsKhoa(null); setKnKhoa(null); setLcKhoa(null); setBuoc(0); };

  return (
    <section id="tim-vot" ref={khung} className={s.picker} aria-labelledby="tim-vot-title">
      <div className={s.world} aria-hidden="true">
        <Image src="/images/landing/hero-court.webp" alt="" fill sizes="100vw" className={s.worldImg} />
      </div>
      <div className={`container ${s.inner}`}>
        <div className={s.intro}>
          <RvHeading id="tim-vot-title" className={`${s.title} ${fontTieuDe.className}`} text="Tìm vợt phù hợp" />
          <p className={s.note} data-rv="up">
            Trả lời ba câu hỏi, chúng tôi đối chiếu độ cân bằng, độ cứng thân và giá ghi trong kho. Đây là gợi ý tham khảo, nên cầm thử vợt khi có thể.
          </p>
          <ol className={s.steps} aria-label="Các bước" data-rv="up">
            {NHAN_BUOC.map((nhan, i) => {
              const xong = !!daChon[i];
              return (
                <li key={nhan}>
                  <button type="button" className={s.step} aria-current={buoc === i ? "step" : undefined} disabled={!coDuLieu || (!xong && buoc !== i)} onClick={() => setBuoc(i)}>
                    <span className={s.stepNo} aria-hidden="true">{xong && buoc !== i ? "✓" : i + 1}</span>
                    <span className={s.stepText}><b>{nhan}</b><span>{daChon[i] ?? "Chưa chọn"}</span></span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className={s.card} aria-busy={kho.trangThai === "loading"} data-rv="up">
          {kho.trangThai === "loading" && (
            <div className={s.state} role="status"><span className={s.spinner} aria-hidden="true" />Đang tải dữ liệu vợt…</div>
          )}
          {kho.trangThai === "error" && (
            <div className={s.state} role="alert">
              <p>Chưa tải được dữ liệu vợt.</p>
              <div className={s.stateActions}>
                <button type="button" className={s.btn} onClick={kho.thuLai}>Thử lại</button>
                <Link href="/SanPham/Index?loai=Vot" className={s.btnGhost}>Xem toàn bộ vợt</Link>
              </div>
            </div>
          )}
          {kho.trangThai === "ok" && !coDuLieu && (
            <div className={s.state}>
              <p>Chưa có đủ dữ liệu vợt để gợi ý.</p>
              <div className={s.stateActions}><Link href="/SanPham/Index?loai=Vot" className={s.btn}>Xem toàn bộ vợt</Link></div>
            </div>
          )}

          {coDuLieu && buoc < 3 && (
            <div key={buoc} className={s.pane}>
              <h3 ref={tieuDe} tabIndex={-1} id="cau-hoi" className={s.question}>{CAU_HOI[buoc]}</h3>
              <div className={s.options} role="group" aria-labelledby="cau-hoi">
                {buoc === 0 && NGAN_SACH_VOT.map((n, i) => (
                  <button key={n.khoa} type="button" className={s.option} aria-pressed={nsKhoa === n.khoa} disabled={dem[i] === 0}
                    onClick={() => chon(0, () => setNsKhoa(n.khoa), !!knKhoa && !!lcKhoa)}>
                    <b>{n.nhan}</b><span>{dem[i]} vợt còn hàng</span>
                  </button>
                ))}
                {buoc === 1 && KINH_NGHIEM.map((k) => (
                  <button key={k.khoa} type="button" className={s.option} aria-pressed={knKhoa === k.khoa}
                    onClick={() => chon(1, () => setKnKhoa(k.khoa), !!nsKhoa && !!lcKhoa)}>
                    <b>{k.nhan}</b><span>{k.mota}</span>
                  </button>
                ))}
                {buoc === 2 && LOI_CHOI.map((l) => (
                  <button key={l.khoa} type="button" className={s.option} aria-pressed={lcKhoa === l.khoa}
                    onClick={() => chon(2, () => setLcKhoa(l.khoa), !!nsKhoa && !!knKhoa)}>
                    <b>{l.nhan}</b><span>{l.mota}</span>
                  </button>
                ))}
              </div>
              {buoc > 0 && <button type="button" className={s.back} onClick={() => setBuoc(buoc - 1)}>← Quay lại</button>}
            </div>
          )}

          {coDuLieu && buoc === 3 && ns && ketQua && (
            <div key="kq" className={s.pane}>
              <h3 ref={tieuDe} tabIndex={-1} className={s.question}>
                {ketQua.goiY.length === 0 ? "Chưa có vợt khớp" : ketQua.khopHoanToan ? "Gợi ý cho bạn" : "Vợt gần nhất với lựa chọn của bạn"}
              </h3>
              {!ketQua.khopHoanToan && ketQua.goiY.length > 0 && (
                <p className={s.hint}>Trong tầm giá này chưa có vợt khớp hoàn toàn với kinh nghiệm và lối chơi bạn chọn. Đây là các cây gần nhất.</p>
              )}
              <ul className={s.results} aria-live="polite">
                {ketQua.goiY.map((g) => (
                  <li key={g.sp.id} className={s.result}>
                    <span className={s.thumb}><ProductImage src={g.sp.hinhAnhDaiDien} alt="" sizes="96px" className={s.thumbImg} /></span>
                    <div className={s.resultBody}>
                      <Link href={`/Home/ChiTietSanPham/${g.sp.id}`} className={s.resultName}
                        onClick={(e) => ghiNhoAnhBam(g.sp.id, e.currentTarget.closest("li")?.querySelector("img") ?? null)}>{g.sp.tenSanPham}</Link>
                      <span className={s.chips}>{g.thongSo.map((t) => <span key={t}>{t}</span>)}</span>
                      <span className={s.reason}>{g.lyDo.join(". ")}.</span>
                    </div>
                    <span className={s.price}>{vnd(g.sp.giaSauKhuyenMai)}</span>
                  </li>
                ))}
              </ul>
              <div className={s.resultActions}>
                <Link href={lienKetVotTheoGia(ns)} className={s.btn}>Xem tất cả vợt {ns.nhan.toLocaleLowerCase("vi")} →</Link>
                <button type="button" className={s.back} onClick={lamLai}>Chọn lại từ đầu</button>
              </div>
              <p className={s.small}>Danh sách đầy đủ lọc theo giá; thông số như độ cân bằng xem ở trang từng sản phẩm.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
