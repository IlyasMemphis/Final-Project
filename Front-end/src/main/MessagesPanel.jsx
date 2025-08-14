// src/main/MessagesPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/messagespanel.module.css";
import defaultAvatar from "../assets/Default avatar.svg";

const API = "http://localhost:3333";

/* helpers */
function authHeader(raw) {
  const t = (raw ?? localStorage.getItem("token") ?? "")
    .replace(/^"+|"+$/g, "")
    .trim();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
const ridFromThread = (t) =>
  String(
    t.user?._id ||
      t.peer?._id ||
      t.peerId ||
      t.userId ||
      t.otherUserId ||
      ""
  );
const keyForThread = (t, i) =>
  String(
    t.peer?._id ||
      t.user?._id ||
      t.lastMessage?._id ||
      t.peerId ||
      t.userId ||
      t.otherUserId ||
      `row-${i}`
  );

/* row */
const ThreadRow = React.memo(function ThreadRow({ t, onPick }) {
  const avatarSrc =
    (t.user?.avatar || t.peer?.avatar || "").trim()
      ? (t.user?.avatar || t.peer?.avatar)
      : defaultAvatar;
  const name = t.user?.username || t.peer?.username || "user";
  const preview = t.lastMessage?.text || "Message";
  const meta = timeAgo(t.lastMessage?.createdAt);
  const unread = Number(t.unreadCount || 0) > 0;

  return (
    <button className={styles.item} onClick={onPick} title={preview}>
      <img src={avatarSrc} alt="" className={styles.avatar} />
      <div className={styles.itemBody}>
        <div className={styles.itemTop}>
          <span className={styles.username}>{name}</span>
          <span className={styles.meta}>{meta}</span>
        </div>
        <div className={styles.preview}>{preview}</div>
      </div>
      {unread && <span className={styles.unreadDot} aria-label="unread" />}
    </button>
  );
});

export default function MessagesPanel({ onClose, token }) {
  const navigate = useNavigate();
  const panelRef = useRef(null);

  const authToken = useMemo(
    () =>
      (token ?? localStorage.getItem("token") ?? "")
        .toString()
        .replace(/^"+|"+$/g, "")
        .trim(),
    [token]
  );

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function loadThreads(signal) {
    const urls = [
      `${API}/api/messages/threads`,
      `${API}/api/threads`,
      `${API}/api/messages`,
      `${API}/messages/threads`,
    ];
    for (const url of urls) {
      try {
        const r = await fetch(url, { headers: authHeader(authToken), signal });
        if (!r.ok) continue;
        const data = await r.json();
        const list = Array.isArray(data) ? data : (data?.threads || data?.data || []);
        return Array.isArray(list) ? list : [];
      } catch {
        /* try next */
      }
    }
    throw new Error("No threads endpoint");
  }

  // load threads
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const list = await loadThreads(ac.signal);
        setThreads(list);
      } catch (e) {
        if (!ac.signal.aborted) {
          setThreads([]);
          setErr("Failed to load messages");
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [authToken]);

  // close on ESC / outside
  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    const onClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
    };
    window.addEventListener("keydown", onEsc);
    window.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onEsc);
      window.removeEventListener("mousedown", onClickOutside);
    };
  }, [onClose]);

  // слушаем «тред прочитан» (из страницы чата) — сразу убираем точку
  useEffect(() => {
    const onRead = (e) => {
      const peerId = String(e?.detail?.peerId || "");
      if (!peerId) return;
      setThreads((rows) =>
        rows.map((r) =>
          ridFromThread(r) === peerId ? { ...r, unreadCount: 0 } : r
        )
      );
    };
    window.addEventListener("thread:read", onRead);
    window.addEventListener("dm:read", onRead); // новое имя события
    return () => {
      window.removeEventListener("thread:read", onRead);
      window.removeEventListener("dm:read", onRead);
    };
  }, []);

  // при входящих — мягко перезагружаем список (чтобы появилась точка)
  useEffect(() => {
    const ac = new AbortController();
    const softReload = async () => {
      try {
        const list = await loadThreads(ac.signal);
        setThreads(list);
      } catch {/* ignore */}
    };
    const onNew = () => setTimeout(softReload, 150);
    window.addEventListener("dm:new", onNew);
    return () => {
      ac.abort();
      window.removeEventListener("dm:new", onNew);
    };
  }, [authToken]);

  const markReadServer = async (peerId) => {
    try {
      await fetch(`${API}/api/messages/thread/${peerId}/read`, {
        method: "PATCH",
        headers: authHeader(authToken),
      });
    } catch {
      /* не критично */
    } finally {
      // принудительный синк бейджа слева
      window.dispatchEvent(new CustomEvent("dm:sync", { detail: { peerId: String(peerId) } }));
    }
  };

  const openThread = (t) => {
    const peerId = ridFromThread(t);
    if (!peerId) return;

    // 1) оптимистично убираем точку в панели
    setThreads((rows) =>
      rows.map((r) =>
        ridFromThread(r) === peerId ? { ...r, unreadCount: 0 } : r
      )
    );

    // 2) сразу схлопываем бейдж Messages слева (без перезагрузки)
    window.dispatchEvent(new CustomEvent("dm:read", { detail: { peerId: String(peerId) } }));
    window.dispatchEvent(new CustomEvent("thread:read", { detail: { peerId: String(peerId) } }));

    // 3) параллельно отмечаем на сервере и мягко синкаем
    markReadServer(peerId);

    // 4) закрываем панель и уходим в чат
    onClose?.();
    navigate(`/messages/${peerId}`);
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.panel} ref={panelRef} role="dialog" aria-label="Messages">
        <header className={styles.header}>
          <h3 className={styles.title}>Messages</h3>
          <button className={styles.close} onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.skeletons}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div className={styles.skeleton} key={`sk-${i}`}>
                  <div className={styles.skelAvatar} />
                  <div className={styles.skelText}>
                    <div className={styles.skelLine} />
                    <div className={`${styles.skelLine} ${styles.skelShort}`} />
                  </div>
                </div>
              ))}
            </div>
          ) : err ? (
            <div className={styles.error}>{err}</div>
          ) : threads.length === 0 ? (
            <div className={styles.empty}>No messages yet</div>
          ) : (
            <>
              <div className={styles.sectionTitle}>Inbox</div>
              <div className={styles.sectionList}>
                {threads.map((t, i) => (
                  <ThreadRow key={keyForThread(t, i)} t={t} onPick={() => openThread(t)} />
                ))}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
