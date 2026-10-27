import {
  analyzeEquipmentItem,
  displayEquipmentName,
  matchEquipmentIcon,
  type EquipmentCatalogItem,
} from "@/lib/equipment-catalog";
import type { EquipmentSlot } from "@/lib/equipment-recommendation";
import styles from "./equipment.module.css";

type Props = {
  slot: EquipmentSlot;
  job: string;
  catalog: EquipmentCatalogItem[];
};
export default function EquipmentSlotCard({ slot, job, catalog }: Props) {
  const parsed = analyzeEquipmentItem(slot.item);
  const item = matchEquipmentIcon(slot.item, slot.slot, job, catalog);
  const isHero = parsed.rarity === "hero";
  const isRare = parsed.rarity === "rare" && (parsed.tier ?? 0) >= 4;
  const qualityClass = isHero ? styles.qualityHero :
    isRare ? styles.qualityRare : styles.qualityUnclassified;
  // The screenshot sprites contain their own rough 1–2px frame.
  // Zoom each tile from 48px to 52px and crop a 2px margin behind a
  // consistent rounded, single-frame border. No adjacent item can bleed in.
  const spriteSize = 52;
  const columns = Math.max(1, Math.min(200, item?.sprite_columns || 7));
  const iconStyle = item?.icon_asset ? item.sprite_index === null ?
    {
      backgroundImage: `url("${item.icon_asset}")`,
      backgroundPosition: "center",
      backgroundSize: "calc(100% + 4px) calc(100% + 4px)",
      backgroundRepeat: "no-repeat",
    } : {
      backgroundImage: `url("${item.icon_asset}")`,
      backgroundPosition: `${-spriteSize * item.sprite_index - 2}px -2px`,
      backgroundSize: `${columns * spriteSize}px ${spriteSize}px`,
      backgroundRepeat: "no-repeat",
    } : undefined;
  const displayName = displayEquipmentName(slot.item);
  const tierLabel = parsed.tier === null ? null :
    (isHero ? `영웅 T${parsed.tier}` : `T${parsed.tier}`);
  const enhancement = slot.enhancement
    ? (slot.enhancement.startsWith("+") ? "" : "+") + slot.enhancement : "";

  return (
    <div className={`${styles.equipmentSlot} ${qualityClass}`}>
      <span
        role="img"
        aria-label={item ? `${item.item_name} 장비 아이콘` : `${slot.slot} 아이콘 미등록`}
        className={`${styles.slotIcon} ${item ? styles.slotIconArt : styles.slotIconPending}`}
        style={iconStyle}
      >
        {item ? null : slot.slot}
      </span>
      <span className={styles.slotInfo}>
        <small>{slot.slot}</small>
        <strong title={slot.item || "미기록"}>{displayName}</strong>
        {slot.personal && <small className={styles.personalPurchase}>개인구매</small>}
      </span>
      <span className={styles.slotMeta}>
        {tierLabel && <em>{tierLabel}</em>}
        {enhancement && <b>{enhancement}</b>}
      </span>
    </div>
  );
}
