import React, { useMemo, useRef, useState } from "react";
import styles from "../styles/edit-profile.module.css";
import defaultAvatar from "../assets/Default avatar.svg";
import { buildAuthHeader } from "../utils/authHeader";
import AvatarCropperModal from "../pages/_AvatarCropperModal";
import { toast } from "react-hot-toast";
import { API_BASE_URL } from "../config/api";

const API = API_BASE_URL || "http://localhost:5000";

/** универсальная попытка нескольких эндпоинтов */
async function tryFetch(urls, init) {
  let lastErr;
  for (const url of urls) {
    try {
      const r = await fetch(url, init);
      if (r.ok) {
        const ct = r.headers.get("content-type") || "";
        return ct.includes("application/json") ? await r.json() : await r.text();
      }
      lastErr = new Error(`${r.status} ${r.statusText}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No endpoints matched");
}

// file -> base64
const blobToDataUrl = (blob) =>
  new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });

export default function EditProfile() {
  const token = useMemo(() => {
    const raw = localStorage.getItem("token");
    return raw ? String(raw).replace(/^"+|"+$/g, "").trim() : "";
  }, []);
  const headerAuth = buildAuthHeader(token);

  const [me, setMe] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null") || {};
    } catch {
      return {};
    }
  });

  // управляемые поля
  const [username, setUsername] = useState(me?.username || "");
  const [website, setWebsite] = useState(me?.website || "");
  const [bio, setBio] = useState(me?.about || me?.bio || ""); // ← читаем и about, и bio

  const [saving, setSaving] = useState(false);

  // кроппер
  const [pickOpen, setPickOpen] = useState(false);
  const [pickedFile, setPickedFile] = useState(null);
  const fileInputRef = useRef(null);

  const onPickAvatar = () => fileInputRef.current?.click();

  // ===== загрузка аватара (с попытками) ===========================
  async function uploadAvatarBlob(blob) {
    // 1) пробуем multipart (разные роуты + разные имена полей)
    const fdFile = new FormData();
    fdFile.append("file", new File([blob], "avatar.png", { type: "image/png" }));
    const fdAvatar = new FormData();
    fdAvatar.append("avatar", new File([blob], "avatar.png", { type: "image/png" }));

    const postInits = [
      { method: "POST", headers: { ...headerAuth }, body: fdFile },
      { method: "POST", headers: { ...headerAuth }, body: fdAvatar },
    ];
    const postUrls = [
      `${API}/api/users/me/avatar`,
      `${API}/api/profile/avatar`,
      `${API}/api/upload/avatar`,
      `${API}/api/upload`,
      `${API}/upload`,
    ];

    for (const init of postInits) {
      try {
        const resp = await tryFetch(postUrls, init);
        const url =
          (resp && (resp.url || resp.avatarUrl || resp.path || resp.location || resp.src)) ||
          (typeof resp === "string" && resp.startsWith("http") ? resp : null);
        if (url) return url;
      } catch {
        /* keep trying */
      }
    }

    // 2) fallback: base64 в PATCH JSON
    const base64 = await blobToDataUrl(blob);
    const jsonBody = (obj) => ({
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headerAuth },
      body: JSON.stringify(obj),
    });
    try {
      const saved = await tryFetch(
        [
          `${API}/api/users/me`,
          `${API}/api/profile/me`,
          `${API}/api/profile`,
          `${API}/api/user/me`,
        ],
        jsonBody({ avatar: base64, avatarUrl: base64 })
      );
      return saved?.user?.avatar || saved?.avatar || saved?.avatarUrl || base64;
    } catch {
      throw new Error("Не удалось загрузить аватар (эндпоинт не найден)");
    }
  }

  async function onCropConfirm(blob) {
    try {
      setSaving(true);
      const url = await uploadAvatarBlob(blob);
      const next = { ...me, avatar: url };
      setMe(next);
      localStorage.setItem("user", JSON.stringify(next));
      toast.success("Avatar updated");
      setPickOpen(false);
      setPickedFile(null);
    } catch (e) {
      toast.error(e.message || "Upload failed");
    } finally {
      setSaving(false);
    }
  }

  // ===== удаление аватарки =======================================
  async function handleDeleteAvatar() {
    if (!me?.avatar) return;

    const ok = window.confirm("Удалить текущую фотографию профиля?");
    if (!ok) return;

    setSaving(true);
    try {
      await tryFetch(
        [
          `${API}/api/users/me`,
          `${API}/api/profile/me`,
          `${API}/api/profile`,
          `${API}/api/user/me`,
        ],
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...headerAuth },
          // пустая строка обнулит avatar на сервере; на клиенте покажем svg по умолчанию
          body: JSON.stringify({ avatar: "", avatarUrl: "" }),
        }
      );

      const next = { ...me, avatar: "" };
      setMe(next);
      localStorage.setItem("user", JSON.stringify(next));
      toast.success("Avatar removed");
    } catch {
      toast.error("Не удалось удалить аватар");
    } finally {
      setSaving(false);
    }
  }

  // ===== сохранение профиля ======================================
  async function handleSave(e) {
    e?.preventDefault?.();
    setSaving(true);
    try {
      // Отправляем И bio, И about — максимальная совместимость
      const payload = { username, website, bio, about: bio };
      await tryFetch(
        [
          `${API}/api/users/me`,
          `${API}/api/profile/me`,
          `${API}/api/profile`,
          `${API}/api/user/me`,
        ],
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...headerAuth },
          body: JSON.stringify(payload),
        }
      );

      const next = { ...me, ...payload };
      setMe(next);
      localStorage.setItem("user", JSON.stringify(next));
      toast.success("Changes saved");
    } catch {
      toast.error("Не получилось сохранить профиль");
    } finally {
      setSaving(false);
    }
  }

  const avatarSrc =
    me?.avatar && String(me.avatar).trim() ? me.avatar : defaultAvatar;

  const isDefaultAvatar = !me?.avatar || String(me.avatar).trim() === "";

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>Edit profile</h1>

        {/* header pill */}
        <div className={styles.head}>
          <div className={styles.headLeft}>
            <img src={avatarSrc} className={styles.avatar} alt="" />
            <div className={styles.titles}>
              <div className={styles.title}>{username || "username"}</div>
              {bio?.trim() ? (
                <div className={styles.subtitle} title={bio}>
                  {bio}
                </div>
              ) : (
                <div className={styles.subtitleMuted}>Add a short bio…</div>
              )}
            </div>
          </div>

          <div className={styles.headRightButtons}>
            <button
              className={styles.newPhotoBtn}
              onClick={onPickAvatar}
              disabled={saving}
            >
              New photo
            </button>

            <button
              className={styles.deletePhotoBtn}
              onClick={handleDeleteAvatar}
              disabled={saving || isDefaultAvatar}
              title={isDefaultAvatar ? "Аватар уже по умолчанию" : "Удалить фото"}
            >
              Delete
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setPickedFile(f);
                setPickOpen(true);
                e.target.value = "";
              }
            }}
          />
        </div>

        {/* form */}
        <form className={styles.form} onSubmit={handleSave}>
          <label className={styles.label}>Username</label>
          <input
            className={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
          />

          <label className={styles.label}>Website</label>
          <div className={styles.urlInputWrap}>
            <span className={styles.urlIcon} aria-hidden>
              🔗
            </span>
            <input
              className={`${styles.input} ${styles.inputWithIcon}`}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              inputMode="url"
            />
          </div>

          <div className={styles.labelRow}>
            <label className={styles.label}>About</label>
            <span className={styles.counter}>{bio.length}/150</span>
          </div>
          <textarea
            className={styles.textarea}
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 150))}
            rows={5}
            placeholder="Short info about you"
          />

          <div className={styles.actions}>
            <button className={styles.saveBtn} type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>

      {pickOpen && pickedFile && (
        <AvatarCropperModal
          file={pickedFile}
          onCancel={() => {
            setPickOpen(false);
            setPickedFile(null);
          }}
          onConfirm={onCropConfirm}
        />
      )}
    </div>
  );
}
