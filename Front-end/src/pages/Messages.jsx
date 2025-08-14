// src/pages/Messages.jsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import styles from "../styles/messages-page.module.css";
import defaultAvatar from "../assets/Default avatar.svg";

const API = "http://localhost:3333";

/* ---------- helpers ---------- */
function makeAuthHeader(raw) {
  const t = (raw ?? localStorage.getItem("token") ?? "").replace(/^"+|"+$/g, "").trim();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
const fmtDateHuman = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  const today = new Date();
  const start = (x) => { const t = new Date(x); t.setHours(0,0,0,0); return t; };
  const diffDays = Math.round((start(today) - start(dt)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return dt.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" });
};
const dayKey = (d) => (d ? new Date(d).toDateString() : "");

/** пробует несколько запросов подряд */
async function tryRequests(requests) {
  let lastErr;
  for (const req of requests) {
    try {
      const r = await fetch(req.url, req.init);
      if (r.ok) return await r.json();
      lastErr = new Error(`${r.status} ${r.statusText}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No endpoints matched");
}

/* отметить тред как прочитанный + известить все панели */
async function markThreadRead(peerId, token) {
  try {
    await fetch(`${API}/api/messages/thread/${peerId}/read`, {
      method: "PATCH",
      headers: makeAuthHeader(token),
    });
  } finally {
    // старое имя события на совместимость
    window.dispatchEvent(new CustomEvent("thread:read", { detail: { peerId: String(peerId) } }));
    // новое — для мгновенного схлопывания бейджа
    window.dispatchEvent(new CustomEvent("dm:read", { detail: { peerId: String(peerId) } }));
    // и мягкая синхронизация числа с сервера
    window.dispatchEvent(new CustomEvent("dm:sync", { detail: { peerId: String(peerId) } }));
  }
}

/* варианты эндпоинтов */
const ENDPOINTS = {
  threads(token) {
    return [
      { url: `${API}/api/messages/threads`, init: { headers: makeAuthHeader(token) } },
      { url: `${API}/api/threads`,         init: { headers: makeAuthHeader(token) } },
      { url: `${API}/api/messages`,         init: { headers: makeAuthHeader(token) } },
      { url: `${API}/messages/threads`,     init: { headers: makeAuthHeader(token) } },
    ];
  },
  history(peerId, token) {
    return [
      { url: `${API}/api/messages/history/${peerId}`,        init: { headers: makeAuthHeader(token) } },
      { url: `${API}/api/messages/${peerId}`,                init: { headers: makeAuthHeader(token) } },
      { url: `${API}/api/messages/thread/${peerId}`,         init: { headers: makeAuthHeader(token) } },
      { url: `${API}/api/messages/history?peerId=${peerId}`, init: { headers: makeAuthHeader(token) } },
    ];
  },
  send(peerId, bodyText, token) {
    const headers = { "Content-Type": "application/json", ...makeAuthHeader(token) };
    return [
      { url: `${API}/api/messages/send`,           init: { method: "POST", headers, body: JSON.stringify({ peerId, text: bodyText }) } },
      { url: `${API}/api/messages`,                init: { method: "POST", headers, body: JSON.stringify({ peerId, text: bodyText }) } },
      { url: `${API}/api/messages`,                init: { method: "POST", headers, body: JSON.stringify({ to: peerId, text: bodyText }) } },
      { url: `${API}/api/messages/send/${peerId}`, init: { method: "POST", headers, body: JSON.stringify({ text: bodyText }) } },
      { url: `${API}/api/messages/${peerId}`,      init: { method: "POST", headers, body: JSON.stringify({ text: bodyText }) } },
    ];
  },
};

export default function MessagesPage() {
  const { peerId } = useParams();
  const [searchParams] = useSearchParams();
  const pane = searchParams.get("pane");
  const listOnly = pane === "list";

  const navigate = useNavigate();

  const token = useMemo(() => {
    const raw = localStorage.getItem("token");
    return raw ? String(raw).replace(/^"+|"+$/g, "").trim() : "";
  }, []);
  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); }
    catch { return null; }
  }, []);

  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);

  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [peer, setPeer] = useState(null);

  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const listRef = useRef(null);

  // прилипать к низу
  const stickToBottom = useRef(true);
  const isNearBottom = () => {
    const el = listRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useLayoutEffect(() => {
    if (!listRef.current) return;
    if (stickToBottom.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [peerId]);

  const handleScroll = () => { stickToBottom.current = isNearBottom(); };

  /* ❗ при входе в чат — сразу оптимистично -1 и синк */
  useEffect(() => {
    if (!peerId) return;
    window.dispatchEvent(new CustomEvent("dm:read", { detail: { peerId: String(peerId) } }));
    window.dispatchEvent(new CustomEvent("dm:sync", { detail: { peerId: String(peerId) } }));
  }, [peerId]);

  /* список тредов */
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoadingThreads(true);
        const data = await tryRequests(ENDPOINTS.threads(token));
        const list = Array.isArray(data) ? data : (data?.threads || []);
        if (!abort) {
          setThreads(list);
          if (!peerId && list.length && !listOnly) {
            const id =
              list[0]?.user?._id ||
              list[0]?.peer?._id ||
              list[0]?.peerId ||
              list[0]?.userId ||
              list[0]?.otherUserId;
            if (id) navigate(`/messages/${id}`, { replace: true });
          }
        }
      } catch {
        if (!abort) setError("Threads endpoint not found");
      } finally {
        if (!abort) setLoadingThreads(false);
      }
    })();
    return () => { abort = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, listOnly, peerId]);

  /* история чата */
  useEffect(() => {
    if (!peerId) { setMessages([]); setPeer(null); return; }
    let abort = false;
    (async () => {
      try {
        setLoadingHistory(true);
        setError("");
        const data = await tryRequests(ENDPOINTS.history(peerId, token));
        const msgs = Array.isArray(data) ? data : (data?.messages || []);
        const p = Array.isArray(data) ? null : (data?.peer || null);
        if (!abort) {
          setPeer(p);
          setMessages(msgs);
          stickToBottom.current = true;
          // серверная пометка + события для перерасчёта бейджа
          markThreadRead(peerId, token);
        }
      } catch {
        if (!abort) { setPeer(null); setMessages([]); setError("Conversation not found"); }
      } finally {
        if (!abort) setLoadingHistory(false);
      }
    })();
    return () => { abort = true; };
  }, [peerId, token]); // eslint-disable-line

  const sendMessage = async () => {
    const body = text.trim();
    if (!body || !peerId) return;

    const optimistic = {
      _id: `tmp_${Date.now()}`,
      sender: me?._id,
      peer: peerId,
      text: body,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((m) => [...m, optimistic]);
    setText("");
    stickToBottom.current = true;

    try {
      const saved = await tryRequests(ENDPOINTS.send(peerId, body, token));
      const normalized = saved?.message || saved;
      setMessages((m) => m.map((x) => (x._id === optimistic._id ? normalized : x)));
    } catch {
      setMessages((m) => m.filter((x) => x._id !== optimistic._id));
      setText(body);
      setError("Send endpoint not found");
    }
  };

  const hasChat = Boolean(peerId);

  return (
    <div className={styles.page} style={{ height: "100%", minHeight: 0, overflow: "hidden", display: "flex" }}>
      <div className={styles.chatCard} style={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
        {!hasChat ? (
          <div className={styles.emptyChat}>
            {loadingThreads ? "Loading…" : "Select a conversation to start messaging"}
          </div>
        ) : loadingHistory ? (
          <div className={styles.emptyChat}>Loading…</div>
        ) : (
          <>
            <div className={styles.topbar}>
              <div className={styles.topbarLeft}>
                <img
                  className={styles.topbarAva}
                  src={peer?.avatar?.trim() ? peer.avatar : defaultAvatar}
                  alt=""
                  onClick={() => peer?._id && navigate(`/profile/${peer._id}`)}
                />
                <button
                  className={styles.topbarName}
                  onClick={() => peer?._id && navigate(`/profile/${peer._id}`)}
                  title="Open profile"
                >
                  {peer?.username || "user"}
                </button>
              </div>
              <button
                className={styles.viewBtn}
                onClick={() => peer?._id && navigate(`/profile/${peer._id}`)}
              >
                View profile
              </button>
            </div>

            <header className={styles.hero}>
              <img
                className={styles.heroAva}
                src={peer?.avatar?.trim() ? peer.avatar : defaultAvatar}
                alt=""
                onClick={() => peer?._id && navigate(`/profile/${peer._id}`)}
              />
              <div className={styles.heroName}>{peer?.username || "user"}</div>
              <div className={styles.heroMeta}>
                {peer?.fullName ? `${peer.fullName} • ICHgram` : "ICHgram"}
              </div>
            </header>

            <div className={styles.list} ref={listRef} onScroll={handleScroll}>
              {messages.length > 0 && (
                <>
                  <div className={styles.dayDivider}>
                    <span>{fmtDateHuman(messages[0]?.createdAt)}</span>
                  </div>

                  {messages.map((m, idx) => {
                    const prev = messages[idx - 1];
                    const needDivider = idx > 0 && dayKey(m.createdAt) !== dayKey(prev?.createdAt);
                    const mine = String(m.sender?._id || m.sender) === String(me?._id);

                    return (
                      <React.Fragment key={m._id}>
                        {needDivider && (
                          <div className={styles.dayDivider}>
                            <span>{fmtDateHuman(m.createdAt)}</span>
                          </div>
                        )}

                        <div className={`${styles.msgRow} ${mine ? styles.mine : ""}`}>
                          {!mine && (
                            <img
                              className={styles.msgAva}
                              src={peer?.avatar?.trim() ? peer.avatar : defaultAvatar}
                              alt=""
                              onClick={() => peer?._id && navigate(`/profile/${peer._id}`)}
                            />
                          )}
                          <div className={styles.msgBlock}>
                            <div className={`${styles.bubble} ${mine ? styles.bubbleMine : styles.bubbleOther}`}>
                              {m.text}
                            </div>
                            <div className={`${styles.msgTime} ${mine ? styles.timeRight : ""}`}>
                              {fmtTime(m.createdAt)}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </>
              )}
            </div>

            <form
              className={styles.inputRow}
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            >
              <input
                className={styles.input}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write message"
              />
              <button className={styles.sendBtn} type="submit" disabled={!text.trim()}>
                Send
              </button>
            </form>
          </>
        )}
        {!!error && <div className={styles.errorBar}>{error}</div>}
      </div>
    </div>
  );
}
