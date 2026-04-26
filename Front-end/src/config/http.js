import axios from "axios";
import { API_BASE_URL } from "./api";
import { getToken } from "../utils/authHeader";

const http = axios.create({
  baseURL: API_BASE_URL || undefined,
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default http;
