import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "../styles/notifications.module.css";
import defaultAvatar from "../assets/Default avatar.svg";
import CommentsModal from "../pages/CommentsModal";
import { formatTimeAgo } from "../utils/utils.js";

const API = "http://localhost:3333";

function authHeader(rawToken) {
  const t = (rawToken ?? localStorage.getItem("token") ?? "")
    .replace(/^"+|"+$/g, "")
    .trim();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function typeText(n) {
  const name = n.fromUser?.username || "User";
  switch (n.type) {
    case "like":          return `${name} liked your post`;
    case "comment":       return `${name} commented on your post`;
    case "like-comment":  return `${name} liked your comment`;
    case "follow":        return `${name} started following you`;
    default:              return "Notification";
  }
}

export default function NotificationsPanel({ onClose, token, currentUser }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [modal, setModal] = useState(null);

  const panelRef = useRef(null);

  const safeToken = useMemo(() => {
    const t = (token ?? localStorage.getItem("token") ?? "")
      .replace(/^"+|"+$/g, "")
      .trim();
    return t;
  }, [token]);

  const me = useMemo(() => {
    return currentUser ?? JSON.parse(localStorage.getItem("user") || "null");
  }, [currentUser]);

  const emitReadDelta = (delta) => {
    try {
      window.dispatchEvent(new CustomEvent("notifications:read", { detail: { delta } }));
    } catch {}
  };
  const emitSync = () => {
    try {
      window.dispatchEvent(new CustomEvent("notifications:sync"));
    } catch {}
  };

  // load
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API}/api/notifications`, { headers: authHeader(safeToken) });
        const data = res.ok ? await res.json() : [];
        if (!abort) setNotifications(Array.isArray(data) ? data : []);
      } catch {
        if (!abort) setNotifications([]);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [safeToken]);

  // close on ESC / outside
  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && !modal && onClose();
    const onClickOutside = (e) => {
      if (modal) return;
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    window.addEventListener("keydown", onEsc);
    window.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onEsc);
      window.removeEventListener("mousedown", onClickOutside);
    };
  }, [onClose, modal]);

  const isUnread = (n) => n?.isRead === false;

  const grouped = useMemo(() => {
    const fresh = [], earlier = [];
    (notifications || []).forEach((n) => (isUnread(n) ? fresh : earlier).push(n));
    return { fresh, earlier };
  }, [notifications]);

  // one -> read
  const markOneAsRead = async (id) => {
    const wasUnread = notifications.some((n) => n._id === id && n.isRead === false);

    setNotifications((list) => list.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    if (wasUnread) emitReadDelta(-1); // мгновенно двигаем бейдж

    try {
      await fetch(`${API}/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader(safeToken) },
        body: JSON.stringify({ isRead: true }),
      });
      emitSync(); // пересчитать точно после сервера
    } catch {
      // можно оставить как есть — при следующем фокусе/открытии всё выровняется
    }
  };

  // all -> read
  const markAllAsRead = async () => {
    if (!notifications.length) return;
    const unreadCount = notifications.reduce((a, n) => a + (n.isRead === false ? 1 : 0), 0);
    if (unreadCount === 0) return;

    setMarkingAll(true);
    const prev = notifications;
    setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
    emitReadDelta(-unreadCount);

    try {
      await fetch(`${API}/api/notifications/read-all`, {
        method: "PATCH",
        headers: authHeader(safeToken),
      });
      emitSync();
    } catch {
      setNotifications(prev);
      emitReadDelta(unreadCount); // компенсируем
    } finally {
      setMarkingAll(false);
    }
  };

  const openTarget = async (n) => {
    if (!n.post?._id) return;
    const commentId = n.comment?._id || n.commentId || null;

    try {
      const res = await fetch(`${API}/api/posts/${n.post._id}`);
      const fullPost = res.ok ? await res.json() : n.post;
      setModal({ post: { ...n.post, ...fullPost }, highlightCommentId: commentId });
    } catch {
      setModal({ post: n.post, highlightCommentId: commentId });
    }
  };

  const Row = ({ n }) => {
    const avatar = n.fromUser?.avatar?.trim() ? n.fromUser.avatar : defaultAvatar;
    const text = typeText(n);
    const unread = isUnread(n);

    return (
      <button
        className={`${styles.item} ${unread ? styles.itemUnread : ""}`}
        onClick={() => { markOneAsRead(n._id); openTarget(n); }}
      >
        <img src={avatar} alt="" className={styles.avatar} />
        <div className={styles.bodyCol}>
          <div className={styles.lineTop}>
            <span className={`${styles.text} ${unread ? styles.textUnread : ""}`} title={text}>
              {text}
            </span>
            {unread && <span className={styles.dotNew} aria-hidden />}
          </div>
          <div className={styles.meta}>{formatTimeAgo(n.createdAt)}</div>
        </div>
        {n.post?.image && <img src={n.post.image} alt="" className={styles.thumb} />}
      </button>
    );
  };

  const Section = ({ title, items }) =>
    items.length ? (
      <>
        <div className={styles.sectionTitle}>{title}</div>
        <div className={styles.sectionList}>
          {items.map((n) => <Row key={n._id} n={n} />)}
        </div>
      </>
    ) : null;

  return (
    <>
      <div className={styles.backdrop} />
      <aside className={styles.panel} ref={panelRef} role="dialog" aria-label="Notifications">
        <header className={styles.header}>
          <h3 className={styles.title}>Notifications</h3>
          <div className={styles.actions}>
            <button
              className={styles.link}
              onClick={markAllAsRead}
              disabled={markingAll || notifications.length === 0}
            >
              Mark all as read
            </button>
            <button className={styles.close} onClick={onClose} aria-label="Close">×</button>
          </div>
        </header>

        <div className={styles.scroll}>
          {loading ? (
            <div className={styles.skeletons}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div className={styles.skeleton} key={i}>
                  <div className={styles.skelAvatar} />
                  <div className={styles.skelText}>
                    <div className={styles.skelLine} />
                    <div className={`${styles.skelLine} ${styles.skelShort}`} />
                  </div>
                  <div className={styles.skelThumb} />
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyTitle}>No notifications yet</div>
              <div className={styles.emptyText}>Likes, comments and follows will appear here.</div>
            </div>
          ) : (
            <>
              <Section title="New" items={grouped.fresh} />
              <Section title="Earlier" items={grouped.earlier} />
            </>
          )}
        </div>
      </aside>

      {modal && (
        <CommentsModal
          post={modal.post}
          token={safeToken}
          onClose={() => setModal(null)}
          currentUser={me}
          highlightCommentId={modal.highlightCommentId}
        />
      )}
    </>
  );
}
