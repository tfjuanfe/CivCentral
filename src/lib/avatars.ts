export const PRESET_AVATARS = [
  { id: "castle", label: "Castle", symbol: "♜", color: "#496b53" },
  { id: "compass", label: "Explorer", symbol: "✦", color: "#426a8c" },
  { id: "quill", label: "Chronicler", symbol: "✎", color: "#79549a" },
  { id: "shield", label: "Guardian", symbol: "⬟", color: "#9a653a" },
  { id: "crown", label: "Sovereign", symbol: "♛", color: "#9a7831" },
  { id: "leaf", label: "Settler", symbol: "❧", color: "#477e78" },
] as const;

export function presetAvatar(value: string | null) {
  return PRESET_AVATARS.find(p => value === `preset:${p.id}`);
}
