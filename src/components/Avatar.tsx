import { presetAvatar } from "@/lib/avatars";

export default function Avatar({ username, value }: { username: string; value: string | null }) {
  const preset = presetAvatar(value);
  return <span className="profile-avatar" style={preset ? { background: preset.color, color: "white" } : undefined}>
    {preset ? <span aria-label={preset.label}>{preset.symbol}</span> : value?.startsWith("https://") ?
      <img src={value} alt={`${username}'s profile picture`} width={72} height={72} referrerPolicy="no-referrer" /> :
      <span aria-label={`${username}'s avatar`}>{username.charAt(0).toUpperCase()}</span>}
  </span>;
}
