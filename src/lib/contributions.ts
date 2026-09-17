export function contributionProgress(published: number) {
  const count = Number.isFinite(published) ? Math.max(0, Math.floor(published)) : 0;
  const milestone = Math.floor(count / 5) * 5;
  return { count, milestone, next: milestone + 5, remaining: milestone + 5 - count };
}
