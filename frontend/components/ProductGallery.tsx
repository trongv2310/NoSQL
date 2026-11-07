"use client";

import { useRef, type RefObject } from "react";
import { TEN_ANH_MORPH } from "@/lib/morph";

const loiAnh = (e: React.SyntheticEvent<HTMLImageElement>) => {
  if (!e.currentTarget.src.endsWith("/images/default-product.jpg")) e.currentTarget.src = "/images/default-product.jpg";
};

export function ProductGallery({ images, selected, name, imageRef, onSelect }: {
  images: string[]; selected: string; name: string; imageRef: RefObject<HTMLImageElement | null>; onSelect: (url: string) => void;
}) {
  const phongTo = useRef<HTMLDialogElement>(null);
  const index = Math.max(0, images.indexOf(selected));
  const di = (offset: number) => onSelect(images[(index + offset + images.length) % images.length]);
  return <div className="pdp-gallery">
    <div className="product-detail-gallery">
      <span className="pdp-photo-count">{String(index + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}</span>
      <button type="button" className="pdp-image-open" aria-label={`Phóng to ảnh ${name}`} onClick={() => phongTo.current?.showModal()}>
        <img key={selected} ref={imageRef} src={selected} alt={name} width={640} height={640} style={{ viewTransitionName: TEN_ANH_MORPH }} onError={loiAnh} />
        <span className="pdp-zoom-hint"><i className="fa-solid fa-magnifying-glass-plus" aria-hidden="true" /> Xem ảnh lớn</span>
      </button>
      {images.length > 1 && <><button type="button" className="pdp-photo-arrow is-prev" aria-label="Ảnh sản phẩm trước" onClick={() => di(-1)}>‹</button><button type="button" className="pdp-photo-arrow is-next" aria-label="Ảnh sản phẩm tiếp theo" onClick={() => di(1)}>›</button></>}
    </div>
    <div className="product-gallery-thumbs" aria-label="Ảnh sản phẩm">{images.map((url, i) => <button key={url} type="button" aria-label={`Xem ảnh ${i + 1}`} aria-pressed={url === selected} onClick={() => onSelect(url)}><img src={url} alt="" width={72} height={72} loading="lazy" onError={loiAnh} /></button>)}</div>
    <dialog ref={phongTo} className="pdp-lightbox" aria-label={`Ảnh lớn: ${name}`} onClick={(e) => { if (e.target === e.currentTarget) phongTo.current?.close(); }}>
      <div className="pdp-lightbox-inner"><div className="pdp-lightbox-head"><span>{name}</span><button type="button" autoFocus aria-label="Đóng ảnh lớn" onClick={() => phongTo.current?.close()}>×</button></div>
        <img src={selected} alt={name} width={960} height={960} onError={loiAnh} />
        {images.length > 1 && <div className="pdp-lightbox-controls"><button type="button" onClick={() => di(-1)}>← Ảnh trước</button><span>{index + 1} / {images.length}</span><button type="button" onClick={() => di(1)}>Ảnh tiếp →</button></div>}
      </div>
    </dialog>
  </div>;
}
