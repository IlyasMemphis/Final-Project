const envValue = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
const normalizedEnv = envValue && !/^https?:\/\//i.test(envValue)
  ? `https://${envValue}`
  : envValue;

const fallbackUrl = import.meta.env.DEV
  ? "http://localhost:5000"
  : "https://final-project-u7l3.onrender.com";

export const API_BASE_URL = normalizedEnv || fallbackUrl;
