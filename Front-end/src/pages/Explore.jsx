import React, { useEffect, useState } from "react";
import styles from "../styles/explore.module.css";
import CommentsModal from "./CommentsModal";

const API = "http://localhost:3333";

function authHeader(t) {
  const raw = t ?? localStorage.getItem("token");
  const token = raw ? String(raw).replace(/^"+|"+$/g, "").trim() : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function Explore({ token, currentUser }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let abort = false;

    async function fetchExplore() {
      try {
        setLoading(true);
        setErr("");

        // 1) основная попытка — /api/explore
        const r1 = await fetch(`${API}/api/explore`, { headers: authHeader(token) });
        let data = r1.ok ? await r1.json() : [];

        // 2) если пусто/ошибка — пробуем /api/posts (фид)
        if (!Array.isArray(data) || data.length === 0) {
          const r2 = await fetch(`${API}/api/posts`, { headers: authHeader(token) });
          if (r2.ok) {
            data = await r2.json();
          }
        }

        if (!abort) {
          setPosts(Array.isArray(data) ? data.filter(p => p && (p.image || p._id)) : []);
        }
      } catch (e) {
        if (!abort) {
          console.error("[Explore] error:", e);
          setErr(e?.message || "Failed to load");
          setPosts([]);
        }
      } finally {
        if (!abort) setLoading(false);
      }
    }

    fetchExplore();
    return () => { abort = true; };
  }, [token]);

  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        {loading && (
          Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={styles.skel}/>
          ))
        )}

        {!loading && posts.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No posts yet</div>
            <div className={styles.emptyText}>
              Добавь публикации или подпишись на кого-нибудь — тут появится сетка.
            </div>
            {err && <div className={styles.errText}>({err})</div>}
          </div>
        )}

        {!loading && posts.length > 0 && posts.map((p) => (
          <button
            key={p._id}
            className={styles.card}
            onClick={() => setSelected(p)}
            aria-label="Open post"
          >
            <img
              className={styles.img}
              src={p.image || `https://placehold.co/800x800?text=Post`}
              alt={p.description || "post"}
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {selected && (
        <CommentsModal
          post={selected}
          token={token}
          currentUser={currentUser}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
