// src/pages/CreatePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import CreatePostModal from "./CreatePostModal.jsx";

const API = "http://localhost:3333";

/** безопасное чтение localStorage JSON */
function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}

export default function CreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sp] = useSearchParams();

  // источник editId: state -> localStorage -> query
  const editId = location?.state?.editId
    || readJSON("editPost")?.id
    || sp.get("edit")
    || null;

  const token = useMemo(() => {
    const raw = localStorage.getItem("token") || "";
    return raw.replace(/^"+|"+$/g, "").trim();
  }, []);
  const currentUser = useMemo(() => readJSON("user"), []);

  const [initial, setInitial] = useState({ loading: !!editId, image: "", caption: "" });

  useEffect(() => {
    let aborted = false;
    if (!editId) { setInitial({ loading: false, image: "", caption: "" }); return; }

    const tries = [
      `${API}/api/posts/${editId}`,
      `${API}/api/post/${editId}`,
      `${API}/posts/${editId}`,
      `${API}/post/${editId}`,
    ];

    (async () => {
      let data = null;
      for (const url of tries) {
        try {
          const r = await fetch(url);
          if (r.ok) { data = await r.json(); break; }
        } catch {}
      }
      if (aborted) return;
      setInitial({
        loading: false,
        image: data?.image || data?.img || readJSON("editPost")?.image || "",
        caption: data?.description || data?.caption || data?.text || readJSON("editPost")?.description || "",
      });
      // подчистим черновик
      try { localStorage.removeItem("editPost"); } catch {}
    })();

    return () => { aborted = true; };
  }, [editId]);

  if (initial.loading) return null;

  return (
    <CreatePostModal
      open
      onClose={() => navigate(-1)}
      token={token}
      currentUser={currentUser}
      mode={editId ? "edit" : "create"}
      postId={editId || undefined}
      initialImageUrl={initial.image}
      initialCaption={initial.caption}
      onCreated={() => {
        try { window.dispatchEvent(new Event("feed:refresh")); } catch {}
        navigate(-1);
        // мягко, но надёжно убираем «призрак» поста
        try { window.location.reload(); } catch {}
      }}
    />
  );
}
