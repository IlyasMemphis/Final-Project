// src/pages/CreatePostModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import defaultAvatar from "../assets/Default avatar.svg";

const API = "http://localhost:3333";

/* ----- utils ----- */
async function readBody(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  try { return ct.includes("application/json") ? await res.json() : await res.text(); }
  catch { return await res.text(); }
}
async function throwHttp(res) {
  const body = await readBody(res);
  const msg = typeof body === "string" ? body : (body?.message || body?.error || `${res.status} ${res.statusText}`);
  const err = new Error(msg); err.status = res.status; err.body = body; throw err;
}
function useBodyLock(isOpen) {
  useEffect(() => {
    if (!isOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const p1 = body.style.overflow, p2 = html.style.overflow;
    body.style.overflow = "hidden"; html.style.overflow = "hidden";
    return () => { body.style.overflow = p1; html.style.overflow = p2; };
  }, [isOpen]);
}

/* ----- компонент ----- */
export default function CreatePostModal({
  open,
  onClose,
  token,
  currentUser,
  onCreated,
  mode = "create",          // "create" | "edit"
  postId,                   // обязателен для edit
  initialImageUrl = "",
  initialCaption = "",
}) {
  useBodyLock(open);
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(initialImageUrl || "");
  const [caption, setCaption] = useState(initialCaption || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // синхронизация с префиллами
  useEffect(() => { setPreview(initialImageUrl || ""); }, [initialImageUrl]);
  useEffect(() => { setCaption(initialCaption || ""); }, [initialCaption]);

  const headerAuth = useMemo(() => {
    const t = (token || localStorage.getItem("token") || "").replace(/^"+|"+$/g, "").trim();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, [token]);

  useEffect(() => {
    if (!open) { setFile(null); setPreview(initialImageUrl || ""); setCaption(initialCaption || ""); setError(""); }
  }, [open, initialImageUrl, initialCaption]);

  const onPick = () => fileInputRef.current?.click();
  const onFile = (f) => { if (!f) return; setFile(f); setPreview(URL.createObjectURL(f)); };
  const onDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); };

  const FILE_FIELDS = ["image","file","photo","video"]; // те, что принимает сервер
  const TEXT_FIELDS = ["description","caption","text"];

  async function tryEach(tries) {
    let lastErr;
    for (const t of tries) {
      try {
        const res = await fetch(t.url, t.init);
        if (!res.ok) throw await (async () => await throwHttp(res))();
        const body = await readBody(res);
        const post = body?.post || body?.data || body;
        if (!post || typeof post !== "object") throw new Error("Invalid response");
        return post;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("No route matched");
  }

  const goToProfileAndReload = () => {
    const profilePath = currentUser?._id
      ? `/profile/${currentUser._id}`
      : currentUser?.username
      ? `/profile/${encodeURIComponent(currentUser.username)}`
      : "/profile";
    try { navigate(profilePath, { replace: true }); } catch {}
    setTimeout(() => window.location.reload(), 0);
  };

  /* ------- CREATE ------- */
  async function createPost() {
    // не даём отправить, если нет файла или пустая подпись
    const hasCaption = caption.trim().length > 0;
    if (!file || !hasCaption) return;

    setSaving(true); setError("");
    try {
      const urls = [
        `${API}/api/posts`,
        `${API}/api/post`,
        `${API}/api/create-post`,
        `${API}/api/posts/create`,
        `${API}/posts/create`,
        `${API}/post`,
        `${API}/posts`,
        `${API}/api/posts/add`,
        `${API}/api/post/create`,
      ];
      const tries = [];
      for (const url of urls) {
        for (const fName of FILE_FIELDS) {
          for (const tName of TEXT_FIELDS) {
            const fd = new FormData();
            fd.append(fName, file);
            fd.append(tName, caption.trim()); // подпись обязательно
            tries.push({ url, init: { method: "POST", headers: { ...headerAuth }, body: fd } });
          }
        }
      }
      const saved = await tryEach(tries);

      try { window.dispatchEvent(new CustomEvent("post:created", { detail: saved })); } catch {}
      onCreated?.(saved);
      onClose?.();

      goToProfileAndReload();
    } catch (e) {
      setError(e?.message || "Failed to create post");
      console.error("Create post failed:", e);
    } finally { setSaving(false); }
  }

  /* ------- UPDATE ------- */
  async function updatePost() {
    if (!postId) return;
    setSaving(true); setError("");
    try {
      const urls = [
        `${API}/api/posts/${postId}`,
        `${API}/api/post/${postId}`,
        `${API}/api/posts/update/${postId}`,
        `${API}/api/post/update/${postId}`,
        `${API}/posts/${postId}`,
        `${API}/post/${postId}`,
        `${API}/posts/${postId}/update`,
        `${API}/post/${postId}/update`,
      ];
      let tries = [];

      if (file) {
        for (const url of urls) {
          for (const fName of FILE_FIELDS) {
            for (const tName of TEXT_FIELDS) {
              const fd = new FormData();
              fd.append(fName, file);
              if (caption.trim()) fd.append(tName, caption.trim());
              for (const method of ["PUT","PATCH","POST"]) {
                tries.push({ url, init: { method, headers: { ...headerAuth }, body: fd } });
              }
            }
          }
        }
      } else {
        const bodies = TEXT_FIELDS.map((t) => ({ [t]: caption.trim() }));
        for (const url of urls) {
          for (const method of ["PUT","PATCH","POST"]) {
            for (const body of bodies) {
              tries.push({
                url,
                init: {
                  method,
                  headers: { "Content-Type": "application/json", ...headerAuth },
                  body: JSON.stringify(body),
                },
              });
            }
          }
        }
      }

      const updated = await tryEach(tries);
      try { window.dispatchEvent(new CustomEvent("post:updated", { detail: updated })); } catch {}
      onCreated?.(updated);
      onClose?.();
    } catch (e) {
      setError(e?.message || "Failed to update post");
      console.error("Update post failed:", e);
    } finally { setSaving(false); }
  }

  const isEdit = mode === "edit";
  const captionEmpty = caption.trim().length === 0;
  const shareDisabled = (!isEdit && (!file || captionEmpty)) || saving;

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,.5)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 12,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        style={{
          width: 1100, maxWidth: "96vw", background: "#fff",
          borderRadius: 12, overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,.25)",
          display: "grid", gridTemplateRows: "48px 1fr",
        }}
      >
        {/* header */}
        <div
          style={{
            height: 48, display: "flex", alignItems: "center",
            justifyContent: "space-between", padding: "0 12px",
            borderBottom: "1px solid #eef0f2", background: "#fafafa", fontWeight: 700,
          }}
        >
          <span style={{ paddingLeft: 4 }}>{isEdit ? "Edit post" : "Create new post"}</span>
          <button
            onClick={isEdit ? updatePost : createPost}
            disabled={shareDisabled}
            style={{
              border: "none", borderRadius: 10, padding: "6px 14px", fontWeight: 800,
              background: shareDisabled
                ? "#cfcdfd"
                : "linear-gradient(135deg,#7C61FF 0%,#9C66FF 100%)",
              color: "#fff", cursor: shareDisabled ? "not-allowed" : "pointer",
            }}
            title={!isEdit && captionEmpty ? "Add a caption to share" : undefined}
          >
            {saving ? (isEdit ? "Saving…" : "Sharing…") : (isEdit ? "Save" : "Share")}
          </button>
        </div>

        {/* content */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(520px, 1fr) 420px", minHeight: 560 }}>
          {/* left */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => !file && !preview && onPick()}
            style={{
              background: "#fafbff", display: "grid", placeItems: "center",
              borderRight: "1px solid #eef0f2", cursor: (!file && !preview) ? "pointer" : "default",
              position: "relative",
            }}
          >
            {(file || preview) ? (
              <img
                src={file ? preview : (preview || initialImageUrl)}
                alt=""
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
              />
            ) : (
              <div style={{ textAlign: "center", color: "#9aa0a6" }}>
                <div
                  style={{
                    width: 92, height: 92, margin: "0 auto 12px", borderRadius: "50%",
                    border: "2px dashed #d8dbff", display: "grid", placeItems: "center",
                    fontSize: 30, color: "#7C61FF",
                  }}
                >
                  ⤒
                </div>
                <div style={{ fontWeight: 700, color: "#111" }}>Drag & drop a photo</div>
                <div style={{ marginTop: 6 }}>or <span style={{ color: "#7C61FF", fontWeight: 700 }}>click to choose</span></div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
          </div>

          {/* right */}
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img
                src={currentUser?.avatar?.trim() ? currentUser.avatar : defaultAvatar}
                alt=""
                style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", background: "#eef2f7" }}
              />
              <div style={{ fontWeight: 800 }}>{currentUser?.username || "user"}</div>
            </div>

            <div style={{ position: "relative", flex: "1 1 auto" }}>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 200))}
                rows={10}
                placeholder="Write a caption…"
                style={{
                  width: "100%", height: 260, resize: "vertical", maxWidth: "350px",
                  border: "1px solid #eef0f2", borderRadius: 10, padding: 12, outline: "none", fontSize: 14,
                }}
              />
              <div style={{ position: "absolute", right: 10, bottom: 10, color: "#9aa0a6", fontSize: 12 }}>
                {caption.length}/200
              </div>
            </div>

            {!!error && (
              <div style={{ color: "#d93025", fontSize: 12, fontWeight: 700, whiteSpace: "pre-wrap" }}>
                {error}
              </div>
            )}

            <button
              onClick={onPick}
              style={{
                alignSelf: "flex-start", border: "1px solid #eef0f2", borderRadius: 10,
                padding: "8px 12px", background: "#fff", fontWeight: 700, cursor: "pointer",
              }}
            >
              {file || preview ? "Replace image…" : "Choose image…"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
