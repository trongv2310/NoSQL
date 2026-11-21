import { LuoiCombo } from "@/components/ComboGoiY";
import { Khu } from "@/components/quay/KhuChung";
import { chonComboHienThi } from "@/lib/goi-y";
import { layGoiYCombo } from "@/lib/server-api";

export async function ComboMuaChung() {
  const combos = chonComboHienThi(await layGoiYCombo());
  if (combos.length === 0) return null;
  return (
    <Khu id="combo-mua-chung" kicker="Mua chung" tieuDe="Combo mua chung">
      <LuoiCombo combos={combos} />
    </Khu>
  );
}
