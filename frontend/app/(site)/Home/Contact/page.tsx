import { Page } from "@/components/Ui";

export default function LienHePage() {
  return (
    <Page>
      <h2 className="page-title mb-4">Liên hệ</h2>
      <div className="row g-4">
        <div className="col-md-6">
          <div className="card h-100"><div className="card-body">
            <h5 className="mb-3">Cửa hàng Cầu Lông HUIT</h5>
            <p><i className="fa-solid fa-location-dot text-success" /> 140 Lê Trọng Tấn, Tây Thạnh, Tân Phú, TP.HCM</p>
            <p><i className="fa-solid fa-phone text-success" /> 0123456789</p>
            <p><i className="fa-solid fa-envelope text-success" /> HUIT@gmail.com</p>
            <p className="mb-0"><i className="fa-solid fa-clock text-success" /> Mở cửa: 8:00 – 21:00 mỗi ngày</p>
          </div></div>
        </div>
        <div className="col-md-6">
          <iframe title="Bản đồ cửa hàng" className="w-100 rounded border" style={{ minHeight: 280, height: "100%" }} loading="lazy"
            src="https://www.google.com/maps?q=140+L%C3%AA+Tr%E1%BB%8Dng+T%E1%BA%A5n,+T%C3%A2y+Th%E1%BA%A1nh,+T%C3%A2n+Ph%C3%BA&output=embed" />
        </div>
      </div>
    </Page>
  );
}
