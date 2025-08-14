import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";               // ← NEW
import styles from "../styles/postcard.module.css";
import defaultAvatar from "../assets/Default avatar.svg";
import toast from "react-hot-toast";
import CommentsModal from "./CommentsModal";
import { formatTimeAgo } from "../utils/utils.js";
import { buildAuthHeader } from "../utils/authHeader";

const API = "http://localhost:3333";

export default function PostCard({ post: propPost, currentUser, token, notification }) {
  const navigate = useNavigate();                             // ← NEW
  const [post, setPost] = useState(propPost);
  const [modalOpen, setModalOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  const currentUserId = currentUser?._id || localStorage.getItem("userId");
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

  // Лайки поста
  useEffect(() => {
    if (!post?._id) return;
    let abort = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/likes/${post._id}/info`, {
          headers: { ...buildAuthHeader() },
        });
        if (!res.ok) return;
        const { count, liked } = await res.json();
        if (!abort) {
          setLikes(Number.isFinite(count) ? count : 0);
          setLiked(!!liked);
        }
      } catch {
        if (!abort) {
          setLikes(post?.likes || 0);
          setLiked(false);
        }
      }
    })();
    return () => { abort = true; };
  }, [post?._id]);

  // Комментарии
  useEffect(() => {
    if (!post?._id) return;
    let abort = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/comments/${post._id}`, {
          headers: { ...buildAuthHeader() },
        });
        const data = res.ok ? await res.json() : [];
        if (!abort) setComments(Array.isArray(data) ? data : []);
      } catch {
        if (!abort) setComments([]);
      }
    })();
    return () => { abort = true; };
  }, [post?._id]);

  // Follow check
  useEffect(() => {
    if (!authorId) return;
    let abort = false;
    fetch(`${API}/api/follow/is-following/${authorId}`, {
      headers: { ...buildAuthHeader() },
    })
      .then((res) => (res.ok ? res.json() : { isFollowing: false }))
      .then((data) => { if (!abort) setIsFollowing(!!data.isFollowing); })
      .catch(() => { if (!abort) setIsFollowing(false); });
    return () => { abort = true; };
  }, [authorId]);

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
        setIsFollowing((f) => !f);
        toast.success(isFollowing ? "Unfollowed!" : "Follow is completed!");
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
        const data = await res.json();
        setComments((prev) => [data.comment, ...prev]);
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
                disabled={loadingFollow}
                style={{
                  background: isFollowing ? "#f2f2f2" : "#0095f6",
                  color: isFollowing ? "#333" : "#fff",
                  cursor: loadingFollow ? "not-allowed" : "pointer",
                  opacity: loadingFollow ? 0.7 : 1,
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

      {post.image && <img src={post.image} alt="" className={styles.image} />}

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
          {comments.length > 0 && (
            <div
              className={styles.commentsCount}
              onClick={() => setModalOpen(true)}
              style={{ cursor: "pointer", color: "#555", paddingLeft: "15px" }}
            >
              Посмотреть все комментарии ({comments.length})
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
