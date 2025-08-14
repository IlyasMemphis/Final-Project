// Всегда берём корректную строку JWT из localStorage
export function getToken() {
  let t = localStorage.getItem("token") || "";
  try {
    if (t && t.trim().startsWith("{")) {
      const obj = JSON.parse(t);
      t = obj.token || "";
    }
  } catch {}
  // срежем кавычки и префикс Bearer, если вдруг сохранили так
  t = String(t).trim().replace(/^"+|"+$/g, "").replace(/^Bearer\s+/i, "");
  // минимальная проверка на «похож на JWT» (должно быть 2 точки)
  if (t.split(".").length !== 3) return "";
  return t;
}

export function buildAuthHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
