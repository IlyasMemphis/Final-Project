// pages/Messages.jsx
import React, { useEffect, useMemo, useState } from "react";
import styles from "../styles/messages.module.css";
import defaultAvatar from "../assets/Default avatar.svg";

const API = "http://localhost:3333";

function buildAuthHeader(rawToken) {
  const t = rawToken ? String(rawToken).replace(/^"+|"+$/g, "").trim() : "";
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function timeAgo(d) {
  if (!d) return "";
  const diff = (Date.now() - new Date(d).getTime()) / 1000; // sec
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function Messages({ token, currentUser }) {
  const auth = useMemo(() => buildAuthHeader(token ?? localStorage.getItem("token")), [token]);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        // если бэка нет — отрисуем демо
        const res = await fetch(`${API}/api/messages/threads`, { headers: { ...auth } });
        let data = [];
        if (res.ok) {
          data = await res.json();
        } else {
          // демо-данные (можно удалить, когда появится API)
          data = [
            {
              _id: "t1",
              user: { username: "nikita", avatar: "" },
              lastMessage: { text: "Sent a message…", createdAt: Date.now() - 2 * 60 * 1000 },
              unreadCount: 2,
            },
            {
              _id: "t2",
              user: { username: "sasha", avatar: "" },
              lastMessage: { text: "See you tomorrow!", createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000 },
              unreadCount: 0,
            },
          ];
        }
        if (!abort) {
          setThreads(Array.isArray(data) ? data : []);
          setActiveId((Array.isArray(data) && data[0]?._id) || null);
        }
      } catch {
        if (!abort) {
          setThreads([]);
          setActiveId(null);
        }
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [auth]);

  return (
    <div className={styles.wrap}>
      {/* ЛЕВАЯ КОЛОНКА — список */}
      <aside className={styles.sidebar}>
        <div className={styles.sbHeader}>
          <h3 className={styles.title}>Messages</h3>
          <button className={styles.newBtn} type="button" title="New message">＋</button>
        </div>

        <div className={styles.searchWrap}>
          <input className={styles.search} placeholder="Search" />
        </div>

        <div className={styles.list}>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div className={styles.skelRow} key={i}>
                <div className={styles.skelAvatar} />
                <div className={styles.skelText}>
                  <div className={styles.skelLine} />
                  <div className={`${styles.skelLine} ${styles.skelShort}`} />
                </div>
              </div>
            ))
          ) : threads.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyTitle}>No messages yet</div>
              <div className={styles.emptyText}>When you chat with people, threads will appear here.</div>
            </div>
          ) : (
            threads.map((t) => {
              const avatar = t.user?.avatar?.trim() ? t.user.avatar : defaultAvatar;
              const isActive = activeId === t._id;
              return (
                <button
                  key={t._id}
                  className={`${styles.row} ${isActive ? styles.active : ""}`}
                  onClick={() => setActiveId(t._id)}
                >
                  <img src={avatar} alt="" className={styles.avatar} />
                  <div className={styles.rowBody}>
                    <div className={styles.rowTop}>
                      <span className={styles.username}>{t.user?.username || "user"}</span>
                      <span className={styles.time}>{timeAgo(t.lastMessage?.createdAt)}</span>
                    </div>
                    <div className={styles.preview} title={t.lastMessage?.text || ""}>
                      {t.lastMessage?.text || "—"}
                    </div>
                  </div>
                  {t.unreadCount > 0 && (
                    <span className={styles.badge}>
                      {t.unreadCount > 9 ? "9+" : t.unreadCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ПРАВАЯ КОЛОНКА — заглушка под чат */}
      <section className={styles.content}>
        {activeId ? (
          <div className={styles.placeholder}>
            <div className={styles.phAvatar} />
            <div className={styles.phTitle}>Select a message</div>
            <div className={styles.phText}>Start a conversation to see messages here.</div>
            <div className={styles.inputBar}>
              <input className={styles.input} placeholder="Write message" disabled />
              <button className={styles.sendBtn} disabled>Send</button>
            </div>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <div className={styles.phAvatar} />
            <div className={styles.phTitle}>Your messages</div>
            <div className={styles.phText}>Choose a conversation on the left to get started.</div>
          </div>
        )}
      </section>
    </div>
  );
}
