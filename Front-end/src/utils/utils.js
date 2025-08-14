// utils.js
export function formatTimeAgo(dateString) {
  const now = new Date();
  const postDate = new Date(dateString);
  const diffMs = now - postDate;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  const diffW = Math.floor(diffD / 7);
  if (diffW < 5) return `${diffW}w`;
  return postDate.toLocaleDateString();
}
