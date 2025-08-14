import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/commentmodal.module.css";
import defaultAvatar from "../assets/Default avatar.svg";
import heartIcon from "../assets/heart.svg";
import heartFilledIcon from "../assets/heart-filled.svg";
import commentIcon from "../assets/comment.svg";
import smileIcon from "../assets/smile.svg";
import { formatTimeAgo } from "../utils/utils.js";
import { buildAuthHeader } from "../utils/authHeader";

const API = "http://localhost:3333";

// безопасно достаём id текущего пользователя
function getCurrentUserIdFromStorage() {
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      if (u && u._id) return String(u._id);
    }
  } catch {}
  const id = localStorage.getItem("userId");
  return id ? String(id) : null;
}

// простая «тост»-плашка (верх, по центру)
function Toast({ message, onDone }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      setShow(false);
      setTimeout(onDone, 250);
    }, 1800);
    return () => clearTimeout(t);
  }, [onDone]);
  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 18,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "rgba(28, 28, 30, 0.95)",
        color: "#fff",
        padding: "10px 14px",
        borderRadius: 10,
        fontSize: 14,
        boxShadow: "0 8px 22px rgba(0,0,0,.35)",
        backdropFilter: "saturate(180%) blur(12px)",
      }}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

// аккуратное окошко-подтверждение (наше, без alert)
function ConfirmModal({ title, text, confirmText = "Delete", cancelText = "Cancel", onConfirm, onCancel }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        zIndex: 9998,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
      onMouseDown={onCancel}
    >
      <div
        style={{
          width: "min(92vw, 420px)",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,.35)",
          overflow: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "18px 20px 8px", fontWeight: 700, fontSize: 18 }}>{title}</div>
        <div style={{ padding: "0 20px 18px", color: "#666", lineHeight: 1.45 }}>{text}</div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            padding: 16,
            background: "#fafafa",
          }}
        >
          <button
            onClick={onCancel}
            style={{
              height: 42,
              borderRadius: 10,
              border: "1px solid #e6e6e6",
              background: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              height: 42,
              borderRadius: 10,
              border: "none",
              background: "#ff3b30",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CommentsModal({
  post,
  onClose,
  currentUser,
  highlightCommentId,
}) {
  const navigate = useNavigate();

  // refs
  const modalRef = useRef(null);
  const inputRef = useRef(null);
  const commentsListRef = useRef(null);
  const commentRefs = useRef({});

  // helper: перейти в профиль
  const goProfile = (u) => {
    if (!u) return;
    const id = u._id || u.id;
    const uname = u.username;
    const path = id
      ? `/profile/${id}`
      : uname
      ? `/profile/${encodeURIComponent(uname)}`
      : null;
    if (path) navigate(path);
  };

  // === пост ===
  const [fullPost, setFullPost] = useState(post);

  // меню «три точки» + подтверждение удаления + тост
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Гидратация поста (если пришёл усечённый объект)
  useEffect(() => {
    let abort = false;
    const p = post;
    if (!p?._id) return;

    const needsHydration =
      !p.author || !p.createdAt || typeof p.description === "undefined";

    if (!needsHydration) {
      setFullPost(p);
      return;
    }

    (async () => {
      try {
        const r = await fetch(`${API}/api/posts/${p._id}`);
        if (!r.ok) return;
        const fresh = await r.json();
        if (!abort) setFullPost({ ...p, ...fresh });
      } catch {
        /* ignore */
      }
    })();

    return () => {
      abort = true;
    };
  }, [post]);

  // === Комментарии ===
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  function normalizeComments(arr) {
    const me = currentUser?._id || getCurrentUserIdFromStorage() || undefined;
    return (Array.isArray(arr) ? arr : []).map((c) => {
      const likesArr = Array.isArray(c.likes) ? c.likes : [];
      const likesCount =
        Number.isFinite(c.likesCount) ? c.likesCount : likesArr.length;
      const liked =
        typeof c.liked === "boolean"
          ? c.liked
          : me
          ? likesArr.some((id) => String(id?._id || id) === String(me))
          : false;

      return { ...c, likesCount, liked };
    });
  }

  useEffect(() => {
    let abort = false;
    if (!fullPost?._id) return;

    (async () => {
      try {
        const res = await fetch(`${API}/api/comments/${fullPost._id}`, {
          headers: { ...buildAuthHeader() },
        });
        const data = res.ok ? await res.json() : [];
        if (!abort) setComments(normalizeComments(data));
      } catch {
        if (!abort) setComments([]);
      }
    })();

    return () => {
      abort = true;
    };
  }, [fullPost?._id]);

  // Прокрутка к конкретному комменту
  useEffect(() => {
    if (!highlightCommentId) return;
    const t = setTimeout(() => {
      const el = commentRefs.current[highlightCommentId];
      if (el && commentsListRef.current) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.background = "rgba(0,149,246,.08)";
        setTimeout(() => (el.style.background = ""), 1000);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [highlightCommentId, comments]);

  // === лайки поста ===
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);

  const fetchLikeInfo = async () => {
    if (!fullPost?._id) return;
    try {
      const res = await fetch(`${API}/api/likes/${fullPost._id}/info`, {
        headers: { ...buildAuthHeader() },
      });
      if (res.ok) {
        const { count, liked } = await res.json();
        setLikes(Number.isFinite(count) ? count : 0);
        setLiked(!!liked);
      } else {
        setLikes(0);
        setLiked(false);
      }
    } catch {
      setLikes(0);
      setLiked(false);
    }
  };

  useEffect(() => {
    if (fullPost?._id) fetchLikeInfo();
  }, [fullPost?._id]);

  const handlePostLike = async () => {
    if (!fullPost?._id) return;
    try {
      const res = await fetch(`${API}/api/likes/${fullPost._id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeader(),
        },
      });
      if (res.ok) {
        const { count, liked } = await res.json();
        setLikes(Number.isFinite(count) ? count : 0);
        setLiked(!!liked);
      }
    } catch {
      /* ignore */
    }
  };

  // === Follow для автора ===
  const currentUserId = currentUser?._id || getCurrentUserIdFromStorage();
  const authorId = fullPost?.author?._id;
  const isOwner = !!(currentUserId && authorId && String(currentUserId) === String(authorId));

  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);

  useEffect(() => {
    if (!authorId || isOwner) return; // для своего поста follow не нужен
    fetch(`${API}/api/follow/is-following/${authorId}`, {
      headers: { ...buildAuthHeader() },
    })
      .then((r) => (r.ok ? r.json() : { isFollowing: false }))
      .then((d) => setIsFollowing(!!d.isFollowing))
      .catch(() => setIsFollowing(false));
  }, [authorId, isOwner]);

  const handleFollow = async () => {
    if (!authorId || isOwner) return;
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
      if (res.ok) setIsFollowing((f) => !f);
    } finally {
      setLoadingFollow(false);
    }
  };

  // Добавить комментарий
  const handleAddComment = async (e) => {
    e.preventDefault();
    const text = newComment.trim();
    if (!text || !fullPost?._id) return;
    setCommentLoading(true);
    try {
      const res = await fetch(`${API}/api/comments/${fullPost._id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeader(),
        },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [
          { ...data.comment, liked: false, likesCount: 0, likes: [] },
          ...prev,
        ]);
        setNewComment("");
      }
    } finally {
      setCommentLoading(false);
    }
  };

  // Лайк/анлайк комментария
  const handleLike = async (commentId, likedNow) => {
    try {
      const res = await fetch(`${API}/api/comments/${commentId}/like`, {
        method: likedNow ? "DELETE" : "POST",
        headers: { ...buildAuthHeader() },
      });
      const data = await res.json();
      if (res.ok && typeof data.likes === "number") {
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId
              ? { ...c, likesCount: data.likes, liked: data.liked }
              : c
          )
        );
      }
    } catch {
      /* ignore */
    }
  };

  // Закрытие по ESC / клику вне
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
    const onEsc = (e) => e.key === "Escape" && onClose();
    const onClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    window.addEventListener("keydown", onEsc);
    window.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onEsc);
      window.removeEventListener("mousedown", onClickOutside);
    };
  }, [onClose]);

  // --- Действия из «⋯» ---
  const handleEdit = () => {
    if (!fullPost?._id || !isOwner) return; // защита
    const payload = {
      id: fullPost._id,
      image: fullPost.image || "",
      description: fullPost.description || "",
    };
    try { localStorage.setItem("editPost", JSON.stringify(payload)); } catch {}
    setMenuOpen(false);
    navigate("/create", { state: { editId: payload.id } });
  };

  const handleCopyLink = async () => {
    const link =
      `${window.location.origin}/post/${fullPost?._id || ""}`.replace(/\/$/, "");
    try {
      await navigator.clipboard.writeText(link);
      setToast("Link copied to clipboard");
    } catch {
      setToast("Failed to copy link");
    }
    setMenuOpen(false);
  };

  const handleDelete = async () => {
    if (!isOwner) return; // защита
    setConfirmDeleteOpen(false);
    try {
      const res = await fetch(`${API}/api/posts/${fullPost._id}`, {
        method: "DELETE",
        headers: { ...buildAuthHeader() },
      });
      if (res.ok) {
        setToast("Post deleted");
        setTimeout(() => { window.location.reload(); }, 500);
      } else {
        setToast("Failed to delete");
      }
    } catch {
      setToast("Failed to delete");
    }
  };

  const Dot = () => (
    <span style={{ color: "#bdbdbd", margin: "0 8px", fontSize: 21 }}>•</span>
  );

  const createdAt = fullPost?.createdAt ? formatTimeAgo(fullPost.createdAt) : "";

  return (
    <>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {confirmDeleteOpen && (
        <ConfirmModal
          title="Delete post?"
          text="You won't be able to undo this action."
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDeleteOpen(false)}
        />
      )}

      {/* всплывающий список действий (экшн-шит) */}
      {menuOpen && (
        <div
          onMouseDown={() => setMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            zIndex: 9997,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "min(92vw, 380px)",
              background: "#fff",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 18px 50px rgba(0,0,0,.35)",
            }}
          >
            {isOwner && (
              <>
                <button
                  onClick={() => setConfirmDeleteOpen(true)}
                  style={sheetBtnStyle(true)}
                >
                  Delete
                </button>
                <div style={dividerStyle} />
                <button onClick={handleEdit} style={sheetBtnStyle()}>
                  Edit
                </button>
                <div style={dividerStyle} />
              </>
            )}
            <button onClick={handleCopyLink} style={sheetBtnStyle()}>
              Copy link
            </button>
            <div style={dividerStyle} />
            <button onClick={() => setMenuOpen(false)} style={sheetBtnStyle()}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className={styles.overlay}>
        <div className={styles.modal} ref={modalRef}>
          <div className={styles.left}>
            {fullPost?.image && (
              <img
                src={fullPost.image}
                alt=""
                className={styles.bigImage}
                style={{ objectFit: "cover", width: "100%", height: "100%", background: "#000" }}
              />
            )}
          </div>

          <div className={styles.right}>
            {/* HEADER */}
            <div className={styles.header}>
              <img
                src={fullPost?.author?.avatar || defaultAvatar}
                className={styles.avatar}
                alt=""
                role="link"
                tabIndex={0}
                onClick={() => goProfile(fullPost?.author)}
                onKeyDown={(e) => e.key === "Enter" && goProfile(fullPost?.author)}
                style={{ cursor: "pointer" }}
              />
              <span
                className={styles.username}
                role="link"
                tabIndex={0}
                onClick={() => goProfile(fullPost?.author)}
                onKeyDown={(e) => e.key === "Enter" && goProfile(fullPost?.author)}
                style={{ cursor: "pointer" }}
              >
                {fullPost?.author?.username || "unknown"}
              </span>
              <Dot />
              <span className={styles.timeAgo}>{createdAt}</span>

              {/* Follow — только если это не мой пост */}
              {!isOwner && authorId && currentUserId && (
                <button
                  className={styles.followBtn}
                  onClick={handleFollow}
                  disabled={loadingFollow}
                  style={{
                    marginLeft: 16,
                    background: isFollowing ? "#f2f2f2" : "#0095f6",
                    color: isFollowing ? "#333" : "#fff",
                    fontWeight: 600,
                    border: "none",
                    borderRadius: 7,
                    padding: "7px 18px",
                    fontSize: 16,
                    cursor: loadingFollow ? "not-allowed" : "pointer",
                    opacity: loadingFollow ? 0.7 : 1,
                    transition: "background .17s",
                  }}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              )}

              {/* «⋯» — ТОЛЬКО для автора поста */}
              {isOwner && (
                <button
                  aria-label="More"
                  onClick={() => setMenuOpen(true)}
                  style={{
                    marginLeft: "auto",
                    background: "transparent",
                    border: "none",
                    fontSize: 28,
                    lineHeight: 1,
                    cursor: "pointer",
                    padding: "4px 10px",
                  }}
                >
                  ⋯
                </button>
              )}
            </div>

            {/* CAPTION */}
            <div className={styles.captionRow}>
              <span
                className={styles.captionUsername}
                role="link"
                tabIndex={0}
                onClick={() => goProfile(fullPost?.author)}
                onKeyDown={(e) => e.key === "Enter" && goProfile(fullPost?.author)}
                style={{ cursor: "pointer" }}
              >
                {fullPost?.author?.username || "unknown"}
              </span>
              <span className={styles.captionText}>
                {fullPost?.description || ""}
              </span>
            </div>

            {/* COMMENTS */}
            <div className={styles.commentsList} ref={commentsListRef}>
              {comments.length === 0 ? (
                <div className={styles.empty}>No comments yet</div>
              ) : (
                comments.map((c, i) => {
                  const user = c.author || c.user;
                  const username = user?.username || "user";
                  const avatar = user?.avatar || defaultAvatar;
                  return (
                    <div
                      className={styles.commentItem}
                      key={c._id || i}
                      ref={(el) => { if (c._id) commentRefs.current[c._id] = el; }}
                    >
                      <img
                        src={avatar}
                        className={styles.commentAvatar}
                        alt=""
                        role="link"
                        tabIndex={0}
                        onClick={() => goProfile(user)}
                        onKeyDown={(e) => e.key === "Enter" && goProfile(user)}
                        style={{ cursor: "pointer" }}
                      />
                      <div className={styles.commentContent}>
                        <div className={styles.commentMain}>
                          <span
                            className={styles.commentAuthor}
                            role="link"
                            tabIndex={0}
                            onClick={() => goProfile(user)}
                            onKeyDown={(e) => e.key === "Enter" && goProfile(user)}
                            style={{ cursor: "pointer" }}
                          >
                            {username}
                          </span>
                          <span className={styles.commentText}>{c.text}</span>
                        </div>
                        <div className={styles.commentFooter}>
                          <span className={styles.commentTimeAgo}>
                            {c.createdAt ? formatTimeAgo(c.createdAt) : ""}
                          </span>
                          {c.likesCount > 0 && (
                            <>
                              <span className={styles.dot}>•</span>
                              <span className={styles.commentLikes}>
                                {c.likesCount} {c.likesCount === 1 ? "like" : "likes"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={styles.commentLikeCol}>
                        <button
                          className={styles.likeBtn}
                          tabIndex={-1}
                          onClick={() => handleLike(c._id, c.liked)}
                          aria-label="Like"
                          type="button"
                        >
                          <img
                            src={c.liked ? heartFilledIcon : heartIcon}
                            alt="like"
                            style={{ width: 18, height: 18 }}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Post actions */}
            <div className={styles.postActions}>
              <button
                className={styles.iconBtn}
                onClick={async () => {
                  await handlePostLike();
                  await fetchLikeInfo();
                }}
              >
                <img
                  src={liked ? heartFilledIcon : heartIcon}
                  alt="like"
                  style={{ width: 26, height: 26 }}
                />
              </button>
              <button className={styles.iconBtn}>
                <img src={commentIcon} alt="comment" style={{ width: 25, height: 25 }} />
              </button>
            </div>

            {/* Likes + time */}
            <div className={styles.likesAndTime}>
              <span className={styles.likesText}>
                {Number.isFinite(likes) ? likes.toLocaleString() : "0"}{" "}
                {likes === 1 ? "like" : "likes"}
              </span>
              <span className={styles.dot}>•</span>
              <span className={styles.timeAgoSecondary}>
                {fullPost?.createdAt ? formatTimeAgo(fullPost.createdAt) : ""}
              </span>
            </div>

            {/* Add comment */}
            <form className={styles.commentForm} onSubmit={handleAddComment}>
              <button
                type="button"
                className={styles.smileBtn}
                tabIndex={-1}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  marginRight: 9,
                  cursor: "pointer",
                }}
              >
                <img src={smileIcon} alt="emoji" style={{ width: 26, height: 26 }} />
              </button>
              <input
                type="text"
                className={styles.input}
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={commentLoading}
                ref={inputRef}
                autoFocus
              />
              <button
                type="submit"
                disabled={commentLoading || !newComment.trim()}
                className={styles.sendBtn}
              >
                Post
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

const sheetBtnStyle = (danger = false) => ({
  width: "100%",
  height: 54,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 16,
  color: danger ? "#ff3b30" : "#111",
});

const dividerStyle = {
  height: 1,
  background: "rgba(0,0,0,.06)",
};
