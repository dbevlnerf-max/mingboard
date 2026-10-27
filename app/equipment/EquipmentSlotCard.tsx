import {
  analyzeEquipmentItem,
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
  const iconStyle = item?.icon_asset ? item.sprite_index === null ?
    {
      backgroundImage: `url("${item.icon_asset}")`,
      backgroundPosition: "center",
      backgroundSize: "contain",
      backgroundRepeat: "no-repeat",
    } : {
      backgroundImage: `url("${item.icon_asset}")`,
      backgroundPosition: `${-48 * item.sprite_index}px 0px`,
      backgroundSize: "336px 48px",
      backgroundRepeat: "no-repeat",
    } : undefined;
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
        {item ? null : "◆"}
      </span>
      <span className={styles.slotInfo}>
        <small>{slot.slot}</small>
        <strong title={slot.item || "미기록"}>{slot.item || "미기록"}</strong>
        {slot.personal && <small className={styles.personalPurchase}>개인구매</small>}
      </span>
      <span className={styles.slotMeta}>
        {parsed.tier && <em>{`T${parsed.tier}`}</em>}
        {enhancement && <b>{enhancement}</b>}
      </span>
    </div>
  );
}
