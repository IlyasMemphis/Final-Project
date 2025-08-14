import React from "react";
import { useNavigate } from "react-router-dom";
import s from "../styles/footer.module.css";

export default function Footer({
  onSearchClick,
  onNotificationsClick,
  onMessagesClick,     // ← НОВОЕ
  onCreateClick,       // ← НОВОЕ
  searchOpen,
  notificationsOpen,
  messagesOpen,        // ← НОВОЕ
}) {
  const navigate = useNavigate();

  return (
    <footer className={s.footer}>
      <nav className={s.nav}>
        <button type="button" className={s.link} onClick={() => navigate("/")}>
          Home
        </button>

        <button
          type="button"
          className={`${s.link} ${searchOpen ? s.active : ""}`}
          onClick={onSearchClick}
        >
          Search
        </button>

        <button
          type="button"
          className={s.link}
          onClick={() => navigate("/explore")}
        >
          Explore
        </button>

        {/* Messages — открываем боковую панель, НЕ навигируем */}
        <button
          type="button"
          className={`${s.link} ${messagesOpen ? s.active : ""}`}
          onClick={onMessagesClick}
        >
          Messages
        </button>

        <button
          type="button"
          className={`${s.link} ${notificationsOpen ? s.active : ""}`}
          onClick={onNotificationsClick}
        >
          Notifications
        </button>

        {/* Create — открываем модалку создания поста */}
        <button
          type="button"
          className={s.link}
          onClick={onCreateClick}
        >
          Create
        </button>
      </nav>

      <div className={s.copy}>© 2025 ICHgram</div>
    </footer>
  );
}
