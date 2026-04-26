import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";               // ← NEW
import styles from "../styles/postcard.module.css";
import defaultAvatar from "../assets/Default avatar.svg";
import toast from "react-hot-toast";
import CommentsModal from "./CommentsModal";
import { formatTimeAgo } from "../utils/utils.js";
import { buildAuthHeader } from "../utils/authHeader";
import { API_BASE_URL } from "../config/api";

const API = API_BASE_URL || "http://localhost:5000";
const followStatusCache = new Map();

const toId = (v) => String(v?._id || v?.id || v || "");

export default function PostCard({ post: propPost, currentUser, token, notification }) {
  const navigate = useNavigate();                             // ← NEW
  const [post, setPost] = useState(propPost);
  const [modalOpen, setModalOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoaded, setFollowLoaded] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  const currentUserId =
    currentUser?._id ||
    currentUser?.id ||
    currentUser?.userId ||
    localStorage.getItem("userId");
  const authorId = post?.author?._id;

  // helper: перейти в профиль
  const goProfile = (u) => {
    if (!u) return;
    const id = u._id || u.id;
    const uname = u.username;
    const path = id ? `/profile/${id}` : uname ? `/profile/${encodeURIComponent(uname)}` : null;
    if (path) navigate(path);
  };

  // Догрузка полного поста
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!post?._id) return;
    if (post.author || hydratedRef.current) return;
    hydratedRef.current = true;
    fetch(`${API}/api/posts/${post._id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setPost((p) => ({ ...p, ...data })))
      .catch(() => { hydratedRef.current = false; });
  }, [post?._id, post?.author]);

  // Синхронизация локальных счётчиков из поста
  useEffect(() => {
    const postLikes = Array.isArray(post?.likes) ? post.likes : [];
    const likesFromPost = Number.isFinite(post?.likesCount)
      ? post.likesCount
      : postLikes.length;
    const likedFromPost = toId(currentUserId)
      ? postLikes.some((u) => toId(u) === toId(currentUserId))
      : false;
    setLikes(Number.isFinite(likesFromPost) ? likesFromPost : 0);
    setLiked(!!likedFromPost);
    setCommentsCount(Number.isFinite(post?.commentsCount) ? post.commentsCount : 0);
  }, [post?._id, post?.likes, post?.likesCount, post?.commentsCount, currentUserId]);

  // Актуальные лайки из API (источник правды: коллекция Like)
  useEffect(() => {
    if (!post?._id) return;
    let abort = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/likes/${post._id}/info`, {
          headers: { ...buildAuthHeader() },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!abort) {
          setLikes(Number.isFinite(data?.count) ? data.count : 0);
          setLiked(!!data?.liked);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { abort = true; };
  }, [post?._id, currentUserId]);

  // Актуальное количество комментариев
  useEffect(() => {
    if (!post?._id) return;
    let abort = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/comments/${post._id}`, {
          headers: { ...buildAuthHeader() },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!abort) setCommentsCount(Array.isArray(data) ? data.length : 0);
      } catch {
        /* ignore */
      }
    })();
    return () => { abort = true; };
  }, [post?._id]);

  // Follow check (кэшируется по authorId, чтобы не дёргать сеть для каждого ререндера)
  useEffect(() => {
    if (!authorId || !currentUserId || toId(authorId) === toId(currentUserId)) {
      setIsFollowing(false);
      setFollowLoaded(true);
      return;
    }
    if (followStatusCache.has(toId(authorId))) {
      setIsFollowing(!!followStatusCache.get(toId(authorId)));
      setFollowLoaded(true);
      return;
    }

    let abort = false;
    fetch(`${API}/api/follow/is-following/${authorId}`, {
      headers: { ...buildAuthHeader() },
    })
      .then((res) => (res.ok ? res.json() : { isFollowing: false }))
      .then((data) => {
        if (!abort) {
          const value = !!data.isFollowing;
          followStatusCache.set(toId(authorId), value);
          setIsFollowing(value);
          setFollowLoaded(true);
        }
      })
      .catch(() => {
        if (!abort) {
          setIsFollowing(false);
          setFollowLoaded(true);
        }
      });
    return () => { abort = true; };
  }, [authorId, currentUserId]);

  // Подписка/отписка
  const handleFollow = async () => {
    if (!authorId) return;
    setLoadingFollow(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch(`${API}/api/follow`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeader(),
        },
        body: JSON.stringify({ userIdToFollow: authorId }),
      });
      if (res.ok) {
        setIsFollowing((f) => {
          const next = !f;
          followStatusCache.set(toId(authorId), next);
          return next;
        });
        toast.success(isFollowing ? "Unfollowed!" : "Follow completed!");
      }
    } finally {
      setLoadingFollow(false);
    }
  };

  // Лайк поста
  const handleLike = async () => {
    if (!post?._id) return;
    try {
      const res = await fetch(`${API}/api/likes/${post._id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeader(),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setLiked(!!data.liked);
        setLikes((l) => (data.liked ? l + 1 : Math.max(0, l - 1)));
      }
    } catch {
      toast.error("Ошибка лайка");
    }
  };

  // Добавить комментарий
  const handleAddComment = async () => {
    const text = newComment.trim();
    if (!text || !post?._id) return;
    setCommentLoading(true);
    try {
      const res = await fetch(`${API}/api/comments/${post._id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeader(),
        },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        await res.json();
        setCommentsCount((c) => c + 1);
        setNewComment("");
      } else {
        toast.error("Ошибка добавления комментария");
      }
    } finally {
      setCommentLoading(false);
    }
  };

  const description = post?.description ?? post?.desciption ?? "";
  const author = post?.author || null;
  if (!post) return null;

  // общие интерактивные props для кликабельных username/avatar
  const linkProps = {
    role: "link",
    tabIndex: 0,
    onClick: () => goProfile(author),
    onKeyDown: (e) => (e.key === "Enter" ? goProfile(author) : null),
    style: { cursor: "pointer" },
  };

  return (
    <div className={styles.post}>
      <div className={styles.header}>
        <img
          src={author?.avatar || defaultAvatar}
          alt="avatar"
          className={styles.avatar}
          {...linkProps}                                         // ← кликабельная аватарка
        />
        <div style={{ flex: 1 }}>
          <div className={styles.usernameRow}>
            <span className={styles.username} {...linkProps}>   {/* ← кликабельный ник */}
              {author?.username || "unknown"}
            </span>
            {currentUserId && author?._id && currentUserId !== author._id && (
              <button
                className={styles.followBtn}
                onClick={handleFollow}
                disabled={loadingFollow || !followLoaded}
                style={{
                  background: isFollowing ? "#f2f2f2" : "#0095f6",
                  color: isFollowing ? "#333" : "#fff",
                  cursor: loadingFollow || !followLoaded ? "not-allowed" : "pointer",
                  opacity: loadingFollow || !followLoaded ? 0.7 : 1,
                }}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </div>
          {post.location && <div className={styles.location}>{post.location}</div>}
        </div>
        <span className={styles.time}>{formatTimeAgo(post.createdAt || new Date())}</span>
      </div>

      {post.image && (
        <img
          src={post.image}
          alt="post"
          className={styles.image}
          onClick={() => setModalOpen(true)}
          style={{ cursor: "pointer" }}
        />
      )}

      <div className={styles.actions}>
        <button className={styles.iconBtn} onClick={handleLike}>
          <span className={liked ? styles.heartFilled : styles.heart} aria-label="like" />
        </button>
        <button className={styles.iconBtn} onClick={() => setModalOpen(true)}>
          <span className={styles.comment} aria-label="comment" />
        </button>
      </div>

      <div className={styles.likes}>
        <b>{likes.toLocaleString()} {likes === 1 ? "like" : "likes"}</b>
      </div>

      <div className={styles.bottomSection}>
        <div className={styles.caption}>
          <span className={styles.username} {...linkProps}>   {/* ← кликабельный ник в подписи */}
            {author?.username || "unknown"}
          </span>{" "}
          <span>{description}</span>
        </div>

        <div style={{ minHeight: 24, marginBottom: 8 }}>
          {commentsCount > 0 && (
            <div
              className={styles.commentsCount}
              onClick={() => setModalOpen(true)}
              style={{ cursor: "pointer", color: "#555", paddingLeft: "15px" }}
            >
              View all comments ({commentsCount})
            </div>
          )}
        </div>

        <form
          className={styles.addComment}
          onSubmit={async (e) => { e.preventDefault(); await handleAddComment(); }}
          style={{ display: "flex", gap: 8, marginTop: "auto", alignItems: "center", width: "100%" }}
        >
          <input
            type="text"
            className={styles.commentInput}
            placeholder="Add comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={commentLoading}
            style={{ flex: 1, padding: 12, borderRadius: 14, border: "none", backgroundColor: "#fff", outline: "none" }}
          />
          <button
            type="submit"
            disabled={commentLoading || !newComment.trim()}
            className={styles.commentBtn}
            style={{ background: "white", color: "#0095f6", border: "none", borderRadius: 6, padding: "8px 16px", fontWeight: 800, cursor: "pointer", opacity: commentLoading || !newComment.trim() ? 0.6 : 1 }}
          >
            Post
          </button>
        </form>
      </div>

      {modalOpen && (
        <CommentsModal
          post={post}
          token={token}
          onClose={() => setModalOpen(false)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
