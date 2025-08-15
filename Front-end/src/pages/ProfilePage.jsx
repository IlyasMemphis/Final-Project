import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "../styles/profile.module.css";
import defaultAvatar from "../assets/Default avatar.svg";
import CommentsModal from "../pages/CommentsModal";
import { buildAuthHeader } from "../utils/authHeader";

const API = "http://localhost:3333";

function isHex24(v) {
  return /^[0-9a-fA-F]{24}$/.test(String(v || ""));
}

async function tryFetch(urls, init) {
  let err;
  for (const u of urls) {
    try {
      const r = await fetch(u, init);
      if (r.ok) return await r.json();
      err = new Error(`${r.status} ${r.statusText}`);
    } catch (e) {
      err = e;
    }
  }
  throw err || new Error("No endpoints matched");
}

// нормализуем URL (добавим https:// если нет)
function normalizeUrl(raw) {
  if (!raw) return "";
  const v = String(raw).trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}
// как показывать в тексте (без https и без www)
function prettyUrl(u) {
  try {
    const n = new URL(normalizeUrl(u));
    const host = n.hostname.replace(/^www\./, "");
    const pathname = n.pathname.replace(/\/$/, "");
    return (host + pathname) || host;
  } catch {
    return u;
  }
}

export default function ProfilePage() {
  const { idOrUsername } = useParams(); // /profile/:idOrUsername
  const navigate = useNavigate();

  const token = useMemo(() => {
    const raw = localStorage.getItem("token");
    return raw ? String(raw).replace(/^"+|"+$/g, "").trim() : "";
  }, []);
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalPost, setModalPost] = useState(null);
  const [error, setError] = useState("");

  // follow state (для чужого профиля)
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);

  const header = { ...buildAuthHeader(token) };

  // загрузка summary
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const id = idOrUsername || "me";
        const urls = [
          `${API}/api/profile/${encodeURIComponent(id)}`,
          isHex24(id)
            ? `${API}/api/profile/${id}`
            : `${API}/api/profile/${encodeURIComponent(id)}`,
        ];
        // важное: выключаем кэш браузера
        const data = await tryFetch(urls, { headers: header, cache: "no-store" });

        if (!abort) {
          setUser(data.user);
          setStats(data.stats || { posts: 0, followers: 0, following: 0 });
          setPosts(Array.isArray(data.posts) ? data.posts : []);
        }
      } catch {
        if (!abort) setError("Failed to load profile");
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idOrUsername, token]);

  const itsMe =
    user && currentUser && String(user._id) === String(currentUser._id);

  // *** ВЫЧИСЛЯЕМ ССЫЛКУ (website) ***
  const website = useMemo(() => {
    let w =
      user?.website ||
      user?.web ||
      user?.url ||
      user?.link ||
      user?.links?.website ||
      user?.social?.website;
    if (!w) {
      try {
        w = JSON.parse(localStorage.getItem("user") || "{}").website || "";
      } catch {}
    }
    return normalizeUrl(w);
  }, [user]);

  // Текст about/bio с фоллбэком на локальное (если это мой профиль)
  const aboutText = useMemo(() => {
    const serverText = ((user?.about ?? user?.bio) || "").trim();
    if (!itsMe) return serverText;
    try {
      const localUser = JSON.parse(localStorage.getItem("user") || "{}");
      const localText = ((localUser?.about ?? localUser?.bio) || "").trim();
      return localText || serverText;
    } catch {
      return serverText;
    }
  }, [user, itsMe]);

  // проверка follow только для чужого профиля
  useEffect(() => {
    if (!user?._id || itsMe) return;
    let abort = false;
    (async () => {
      try {
        const r = await fetch(`${API}/api/follow/is-following/${user._id}`, {
          headers: header,
        });
        const d = r.ok ? await r.json() : { isFollowing: false };
        if (!abort) setIsFollowing(!!d.isFollowing);
      } catch {
        if (!abort) setIsFollowing(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [user?._id, itsMe, token]); // eslint-disable-line

  const handleFollowToggle = async () => {
    if (!user?._id || itsMe) return;
    setLoadingFollow(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const r = await fetch(`${API}/api/follow`, {
        method,
               headers: { "Content-Type": "application/json", ...header },
        body: JSON.stringify({ userIdToFollow: user._id }),
      });
      if (r.ok) {
        setIsFollowing((f) => !f);
        setStats((s) => ({
          ...s,
          followers: Math.max(0, s.followers + (isFollowing ? -1 : 1)),
        }));
      }
    } finally {
      setLoadingFollow(false);
    }
  };

  // === LOGOUT ===
  const handleLogout = async () => {
    try {
      await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        headers: { ...header },
      }).catch(() => {});
    } finally {
      try { localStorage.removeItem("token"); } catch {}
      try { localStorage.removeItem("user"); } catch {}
      navigate("/login", { replace: true });
      setTimeout(() => window.location.reload(), 0);
    }
  };

  if (loading)
    return (
      <div className={styles.page}>
        <div className={styles.center}>Loading…</div>
      </div>
    );
  if (error)
    return (
      <div className={styles.page}>
        <div className={styles.center}>{error}</div>
      </div>
    );
  if (!user)
    return (
      <div className={styles.page}>
        <div className={styles.center}>User not found</div>
      </div>
    );

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        {/* header */}
        <div className={styles.header}>
          <img
            className={styles.avatar}
            src={user.avatar?.trim() ? user.avatar : defaultAvatar}
            alt=""
          />

          <div className={styles.headCol}>
            <div className={styles.row1}>
              <div className={styles.username}>{user.username}</div>

              {/* Кнопки справа от username */}
              {itsMe ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className={styles.editBtn}
                    onClick={() => navigate("/profile/edit")}
                  >
                    Edit profile
                  </button>

                  {/* LOG OUT */}
                  <button
                    onClick={handleLogout}
                    title="Log out"
                    style={{
                      background: "#fff",
                      color: "#d93025",
                      border: "1px solid #ffd7d7",
                      borderRadius: 8,
                      padding: "8px 16px",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleFollowToggle}
                    disabled={loadingFollow}
                    style={{
                      background: isFollowing ? "#f2f2f2" : "#0095f6",
                      color: isFollowing ? "#111" : "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 16px",
                      fontWeight: 700,
                      cursor: loadingFollow ? "not-allowed" : "pointer",
                      opacity: loadingFollow ? 0.7 : 1,
                    }}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </button>

                  <button
                    onClick={() => navigate(`/messages/${user._id}`)}
                    style={{
                      background: "#f2f2f2",
                      color: "#111",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 16px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Message
                  </button>
                </div>
              )}
            </div>

            <div className={styles.row2}>
              <div>
                <b>{stats.posts}</b> posts
              </div>
              <div>
                <b>{stats.followers}</b> followers
              </div>
              <div>
                <b>{stats.following}</b> following
              </div>
            </div>

            {/* БИО/ABOUT */}
            {aboutText && <div className={styles.bio}>{aboutText}</div>}

            {/* ССЫЛКА НА САЙТ */}
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.website}
                title={website}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 2a10 10 0 100 20 10 10 0 000-20Zm0 2a8 8 0 016.32 12.9l-1.45-1.45A6 6 0 0012 6a6 6 0 00-4.87 9.45L5.68 16.9A8 8 0 0112 4Zm-2.12 9.88a3 3 0 014.24 0l2.12 2.12-1.41 1.41-2.12-2.12a1 1 0 00-1.42 0l-2.12 2.12-1.41-1.41 2.12-2.12Z"
                    fill="currentColor"
                  />
                </svg>
                <span className={styles.websiteText}>{prettyUrl(website)}</span>
              </a>
            )}
          </div>
        </div>

        {/* grid */}
        <div className={styles.grid}>
          {posts.map((p) => (
            <button
              key={p._id}
              className={styles.cell}
              onClick={() => setModalPost(p)}
              title={p.description || ""}
            >
              <img src={p.image} alt="" />
            </button>
          ))}
          {posts.length === 0 && (
            <div className={styles.empty}>No posts yet</div>
          )}
        </div>
      </div>

      {modalPost && (
        <CommentsModal
          post={{ _id: modalPost._id, image: modalPost.image, author: user }}
          token={token}
          currentUser={currentUser}
          onClose={() => setModalPost(null)}
        />
      )}
    </div>
  );
}
