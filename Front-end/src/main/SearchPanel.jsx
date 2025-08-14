import React, { useEffect, useRef, useState } from "react";
import styles from "../styles/searchpanel.module.css";
import defaultAvatar from "../assets/Default avatar.svg";

export default function SearchPanel({ onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const panelRef = useRef(null);

  useEffect(() => {
    function onEsc(e) {
      if (e.key === "Escape") onClose();
    }
    function onClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener("keydown", onEsc);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [onClose]);

  useEffect(() => {
  // ! Не очищаем! При пустом query грузим всех
  const token = localStorage.getItem("token");
  fetch(`http://localhost:3333/api/search/users?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => setResults(Array.isArray(data) ? data : []))
    .catch(() => setResults([]));
}, [query]);


  return (
    <div
      ref={panelRef}
      className={styles.panel}
      tabIndex={-1} // нужно для onBlur, если потребуется
    >
      <div className={styles.header}>
        <span className={styles.title}>Search</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">&times;</button>
      </div>
      <div className={styles.content}>
        <div className={styles.inputWrapper}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search users"
            className={styles.input}
            autoFocus
          />
        </div>
        <div>
          {results.length === 0 && query.trim() !== "" && (
            <div className={styles.empty}>No users found</div>
          )}
          {results.map((user) => (
            <div className={styles.result} key={user._id}>
              <img
                src={user.avatar && user.avatar.trim() !== "" ? user.avatar : defaultAvatar}
                alt=""
                className={styles.avatar}
              />
              <span className={styles.text}>{user.username}</span>
              {/* Follow/Unfollow или переход на профиль */}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
