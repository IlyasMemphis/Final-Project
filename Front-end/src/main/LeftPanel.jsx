import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logoImg from "../assets/ICHGRA 2.svg";
import styles from "../styles/panel.module.css";

import homeImg from "../assets/Img - Главная.svg";
import homeBlackImg from "../assets/Img - Главная black.svg";

import searchImg from "../assets/search.svg";
import searchBlackImg from "../assets/search-filled.svg";

import compasImg from "../assets/Img - Интересное.svg";
import compasBlackImg from "../assets/Img - Интересное black.svg";

import messageImg from "../assets/Img - Messenger.svg";
import messageBlackImg from "../assets/Img - Messenger black.svg";

import heartImg from "../assets/Img - Уведомления.svg";
import heartBlackImg from "../assets/heart - black.svg";

import createImg from "../assets/Img - Новая публикация.svg";
import defaultAvatar from "../assets/Default avatar.svg";

const API = "http://localhost:3333";

function authHeader(token) {
  const t = (token ?? localStorage.getItem("token") ?? "")
    .toString()
    .replace(/^"+|"+$/g, "")
    .trim();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
const idStr = (v) => String(v ?? "");

export default function LeftPanel({
  onNotificationsClick,
  notificationsOpen,
  onSearchClick,
  searchOpen,
  onMessagesClick,
  messagesOpen,
  onCreateClick,
  setActiveExternal,
  unreadCount: unreadCountProp,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [routeActive, setRouteActive] = useState("home");

  // бейджи
  const [notifUnread, setNotifUnread] = useState(0);
  const [dmUnread, setDmUnread] = useState(0);
  const dmRef = useRef(0);

  const token = useMemo(() => {
    const raw = localStorage.getItem("token");
    return raw ? String(raw).replace(/^"+|"+$/g, "").trim() : "";
  }, []);

  // live user
  useEffect(() => {
    const readUser = () => {
      try { setUser(JSON.parse(localStorage.getItem("user") || "null")); }
      catch { setUser(null); }
    };
    readUser();
    const onStorage = (e) => {
      if (e.key === "user" || e.key === "token") readUser();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (typeof setActiveExternal === "function") setActiveExternal(setRouteActive);
  }, [setActiveExternal]);

  useEffect(() => {
    const p = location.pathname;
    if (p === "/" || p.startsWith("/feed")) setRouteActive("home");
    else if (p.startsWith("/explore")) setRouteActive("explore");
    else if (p.startsWith("/messages")) setRouteActive("messages");
    else if (p.startsWith("/profile")) setRouteActive("profile");
    else setRouteActive("");
  }, [location.pathname]);

  /* ================= NOTIFICATIONS BADGE ================= */
  useEffect(() => {
    if (typeof unreadCountProp === "number") {
      setNotifUnread(unreadCountProp);
      return;
    }
    let abort = false;

    const fetchUnread = async () => {
      try {
        const res = await fetch(`${API}/api/notifications`, {
          headers: authHeader(token),
          cache: "no-store",
        });
        if (!res.ok) return;
        const list = await res.json();
        if (!abort) {
          const count = Array.isArray(list)
            ? list.reduce((acc, n) => acc + (n?.isRead === false ? 1 : 0), 0)
            : 0;
          setNotifUnread(count);
        }
      } catch {
        /* keep previous */
      }
    };

    fetchUnread();

    const onFocus = () => fetchUnread();
    const onLocalDelta = (e) => {
      const delta = Number(e?.detail?.delta || 0);
      if (!delta) return;
      setNotifUnread((c) => Math.max(0, c + delta));
    };
    const onSync = () => fetchUnread();

    window.addEventListener("focus", onFocus);
    window.addEventListener("notifications:read", onLocalDelta);
    window.addEventListener("notifications:sync", onSync);

    return () => {
      abort = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("notifications:read", onLocalDelta);
      window.removeEventListener("notifications:sync", onSync);
    };
  }, [token, unreadCountProp]);

  /* ================= MESSAGES BADGE (debounce + serialize) ================= */
  useEffect(() => {
    if (!token) { dmRef.current = 0; setDmUnread(0); return; }

    // один контроллер на жизненный цикл эффекта (для unmount)
    const effectAbort = new AbortController();

    // дедупликация/сериализация
    const inFlightRef = { current: false };
    const queuedRef = { current: false };
    const timerRef = { current: null };
    const lastRunRef = { current: 0 };
    const MIN_GAP = 200; // мс между запросами

    const myId = (() => {
      try { return idStr((user?._id) || JSON.parse(localStorage.getItem("user") || "{}")._id); }
      catch { return ""; }
    })();

    const computeUnreadCount = (threads) => {
      if (!Array.isArray(threads)) return 0;
      return threads.reduce((acc, t) => {
        if (typeof t.unreadCount === "number") return acc + (t.unreadCount > 0 ? 1 : 0);
        if (typeof t.unread === "boolean")    return acc + (t.unread ? 1 : 0);
        const last = t.lastMessage || t.last || t.latest;
        if (!last) return acc;
        const mine = idStr(last.sender?._id || last.sender) === myId;
        const read = !!(last.isRead ?? last.read ?? last.seen);
        return (!mine && !read) ? acc + 1 : acc;
      }, 0);
    };

    const loadThreads = async (signal) => {
      const urls = [
        `${API}/api/messages/threads`,
        `${API}/api/threads`,
        `${API}/api/messages`,
        `${API}/messages/threads`,
      ];
      for (const url of urls) {
        try {
          const r = await fetch(url, {
            headers: authHeader(token),
            signal,
            cache: "no-store",
          });
          if (!r.ok) continue;
          const data = await r.json();
          const list = Array.isArray(data) ? data : (data?.threads || data?.data || []);
          return Array.isArray(list) ? list : [];
        } catch (e) {
          if (e?.name === "AbortError") return []; // тихо выходим, если размонт
          // try next
        }
      }
      return [];
    };

    const doFetch = async () => {
      if (inFlightRef.current) { queuedRef.current = true; return; }
      inFlightRef.current = true;
      try {
        const threads = await loadThreads(effectAbort.signal);
        const count = computeUnreadCount(threads);
        dmRef.current = count;
        setDmUnread(count);
      } finally {
        inFlightRef.current = false;
        if (queuedRef.current) {
          queuedRef.current = false;
          // минимальный интервал между подряд идущими запросами
          const elapsed = Date.now() - lastRunRef.current;
          const delay = elapsed >= MIN_GAP ? 0 : MIN_GAP - elapsed;
          timerRef.current = setTimeout(() => {
            lastRunRef.current = Date.now();
            doFetch();
          }, delay);
        }
      }
    };

    const schedule = () => {
      const now = Date.now();
      const elapsed = now - lastRunRef.current;
      if (elapsed >= MIN_GAP && !inFlightRef.current) {
        lastRunRef.current = now;
        doFetch();
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
        const delay = Math.max(0, MIN_GAP - elapsed);
        timerRef.current = setTimeout(() => {
          lastRunRef.current = Date.now();
          doFetch();
        }, delay);
      }
    };

    // первичная загрузка
    schedule();

    const onFocus = () => schedule();
    const onVisibility = () => { if (document.visibilityState === "visible") schedule(); };
    const onNew = () => schedule();
    const onSync = () => schedule();
    const onRead = () => {
      dmRef.current = Math.max(0, dmRef.current - 1);
      setDmUnread(dmRef.current);
      schedule();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("dm:new", onNew);
    window.addEventListener("dm:sync", onSync);
    window.addEventListener("dm:read", onRead);
    window.addEventListener("thread:read", onRead);

    return () => {
      effectAbort.abort(); // корректно завершаем при размонтаже
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("dm:new", onNew);
      window.removeEventListener("dm:sync", onSync);
      window.removeEventListener("dm:read", onRead);
      window.removeEventListener("thread:read", onRead);
    };
  }, [token, user?._id]);

  const notifBadgeText = notifUnread > 9 ? "9+" : notifUnread > 0 ? String(notifUnread) : "";
  const dmBadgeText    = dmUnread    > 9 ? "9+" : dmUnread    > 0 ? String(dmUnread)    : "";

  const isHomeActive =
    routeActive === "home" && !searchOpen && !messagesOpen && !notificationsOpen;
  const isExploreActive =
    routeActive === "explore" && !searchOpen && !messagesOpen && !notificationsOpen;
  const isProfileActive =
    routeActive === "profile" && !searchOpen && !messagesOpen && !notificationsOpen;

  const profilePath = user?._id
    ? `/profile/${user._id}`
    : user?.username
    ? `/profile/${encodeURIComponent(user.username)}`
    : "/profile";

  return (
    <div className={styles.container}>
      <div className={styles.logoWrapper}>
        <img src={logoImg} alt="ICHGRAM" className={styles.logoImg} />
      </div>

      <div className={styles.menu}>
        {/* Home */}
        <button
          type="button"
          className={`${styles.menuItem} ${isHomeActive ? styles.active : ""}`}
          onClick={() => {
            navigate("/");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-current={isHomeActive ? "page" : undefined}
        >
          <img src={isHomeActive ? homeBlackImg : homeImg} className={styles.menuIcon} alt="" />
          <span className={styles.menuText}>Home</span>
        </button>

        {/* Search */}
        <button
          type="button"
          className={`${styles.menuItem} ${searchOpen ? styles.active : ""}`}
          onClick={() => onSearchClick?.()}
          aria-pressed={searchOpen}
        >
          <img src={searchOpen ? searchBlackImg : searchImg} className={styles.menuIcon} alt="" />
          <span className={styles.menuText}>Search</span>
        </button>

        {/* Explore */}
        <button
          type="button"
          className={`${styles.menuItem} ${isExploreActive ? styles.active : ""}`}
          onClick={() => {
            navigate("/explore");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-current={isExploreActive ? "page" : undefined}
        >
          <img src={isExploreActive ? compasBlackImg : compasImg} className={styles.menuIcon} alt="" />
          <span className={styles.menuText}>Explore</span>
        </button>

        {/* Messages — с бейджем тредов */}
        <button
          type="button"
          className={`${styles.menuItem} ${messagesOpen ? styles.active : ""}`}
          onClick={() => onMessagesClick?.()}
          aria-pressed={messagesOpen}
        >
          <span className={styles.menuIconWrap}>
            <img src={messagesOpen ? messageBlackImg : messageImg} className={styles.menuIcon} alt="" />
            {dmBadgeText && <span className={styles.notifBadge}>{dmBadgeText}</span>}
          </span>
          <span className={styles.menuText}>Messages</span>
        </button>

        {/* Notifications — с мгновенным обновлением по событиям */}
        <button
          type="button"
          className={`${styles.menuItem} ${notificationsOpen ? styles.active : ""}`}
          onClick={() => onNotificationsClick?.()}
          aria-pressed={notificationsOpen}
        >
          <span className={styles.menuIconWrap}>
            <img src={notificationsOpen ? heartBlackImg : heartImg} className={styles.menuIcon} alt="" />
            {notifBadgeText && <span className={styles.notifBadge}>{notifBadgeText}</span>}
          </span>
          <span className={styles.menuText}>Notifications</span>
        </button>

        {/* Create */}
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => onCreateClick?.()}
        >
          <img src={createImg} className={styles.menuIcon} alt="" />
          <span className={styles.menuText}>Create</span>
        </button>
      </div>

      <div className={styles.spacer} />

      {/* Profile */}
      <button
        type="button"
        className={`${styles.profile} ${isProfileActive ? styles.active : ""}`}
        onClick={() => {
          if (!token) { navigate("/login"); return; }
          navigate(profilePath);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        aria-current={isProfileActive ? "page" : undefined}
      >
        <img
          src={user?.avatar?.trim() ? user.avatar : defaultAvatar}
          alt="User avatar"
          className={styles.profileImg}
        />
        <span className={styles.menuText}>Profile</span>
      </button>
    </div>
  );
}
