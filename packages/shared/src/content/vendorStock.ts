import type { ToolId } from '../types/ids';

/**
 * A single Buy-stock line at a Vendor (see CONTEXT.md: Buy; ADR-0030): a piece
 * of Equipment offered for a flat Gold price. Buying grants the Equipment to the
 * player's owned set (it is NOT auto-equipped — the player equips it).
 */
export interface VendorStockEntry {
  equipmentId: ToolId;
  goldCost: number;
}

/**
 * Per-Vendor Buy stock, keyed by the Vendor's id (its Cursor-skin id, matching
 * the client `VendorProfile`). Sim-authoritative pricing/validation reads this;
 * the client renders the same table in the Buy tab. The Black Market Equipment
 * stall is the first Buy Vendor — the starter Pickaxe is the Mining-unlock
 * purchase (see ADR-0030); higher tiers are deterministic upgrades.
 */
export const VENDOR_STOCK: Record<string, readonly VendorStockEntry[]> = {
  blackmarket_equipment: [
    { equipmentId: 'pickaxe_rusty', goldCost: 20 },
    { equipmentId: 'axe_stone', goldCost: 120 },
    { equipmentId: 'pickaxe_stone', goldCost: 120 },
    { equipmentId: 'axe_iron', goldCost: 400 },
    { equipmentId: 'pickaxe_iron', goldCost: 400 },
  ],
};

/** The Buy stock for a Vendor id (empty when the Vendor sells nothing). */
export function vendorStock(vendorId: string): readonly VendorStockEntry[] {
  return VENDOR_STOCK[vendorId] ?? [];
}

/** The stock line for `equipmentId` at `vendorId`, or undefined if not stocked. */
export function findVendorStockEntry(
  vendorId: string,
  equipmentId: ToolId,
): VendorStockEntry | undefined {
  return vendorStock(vendorId).find((e) => e.equipmentId === equipmentId);
}
