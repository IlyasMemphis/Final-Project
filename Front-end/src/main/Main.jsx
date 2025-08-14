import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import LeftPanel from "./LeftPanel";
import Feed from "../pages/Feed";
import Explore from "../pages/Explore";
import NotificationsPanel from "./NotificationsPanel";
import SearchPanel from "./SearchPanel";
import MessagesPanel from "./MessagesPanel";
import Footer from "./Footer";

import CreatePostModal from "../pages/CreatePostModal";   // ← модалка создания

export default function Main() {
  const location = useLocation();
  const isExplore = location.pathname.startsWith("/explore");

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);    // ← состояние Create

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

  const openSearch = () => {
    setSearchOpen(true);
    setNotificationsOpen(false);
    setMessagesOpen(false);
  };
  const toggleNotifications = () => {
    setNotificationsOpen((v) => !v);
    if (!notificationsOpen) {
      setSearchOpen(false);
      setMessagesOpen(false);
    }
  };
  const toggleMessages = () => {
    setMessagesOpen((v) => !v);
    if (!messagesOpen) {
      setSearchOpen(false);
      setNotificationsOpen(false);
    }
  };
  const closeSearch = () => setSearchOpen(false);
  const closeNotifications = () => setNotificationsOpen(false);
  const closeMessages = () => setMessagesOpen(false);

  // затемнение под панели
  const dim = notificationsOpen || searchOpen || messagesOpen;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <LeftPanel
        notificationsOpen={notificationsOpen}
        searchOpen={searchOpen}
        messagesOpen={messagesOpen}
        onNotificationsClick={toggleNotifications}
        onSearchClick={openSearch}
        onMessagesClick={toggleMessages}
        onCreateClick={() => setCreateOpen(true)}
      />

      <div
        style={{
          flex: 1,
          marginLeft: 240,
          position: "relative",
          background: "white",
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        {dim && (
          <div
            style={{
              position: "fixed",
              zIndex: 900,
              inset: 0,
              background: "rgba(0,0,0,.18)",
              pointerEvents: "none",
            }}
          />
        )}

        <div
          style={{
            flex: 1,
            minHeight: 0,
            width: "100%",
            maxWidth: 1024,
            alignSelf: "center",
            paddingTop: 8,
            paddingLeft: 8,
            paddingRight: 8,
            boxSizing: "border-box",
          }}
        >
          {isExplore ? (
            <Explore token={token} currentUser={currentUser} />
          ) : (
            <Feed token={token} currentUser={currentUser} />
          )}
        </div>

        {notificationsOpen && (
          <NotificationsPanel onClose={closeNotifications} token={token} currentUser={currentUser} />
        )}
        {searchOpen && (
          <SearchPanel onClose={closeSearch} token={token} currentUser={currentUser} />
        )}
        {messagesOpen && (
          <MessagesPanel onClose={closeMessages} token={token} currentUser={currentUser} />
        )}

        <div
          style={{
            width: "100%",
            maxWidth: 1024,
            alignSelf: "center",
            marginTop: "auto",
            paddingLeft: 8,
            paddingRight: 8,
            boxSizing: "border-box",
          }}
        >
          <Footer
            onSearchClick={openSearch}
            onNotificationsClick={toggleNotifications}
            onMessagesClick={toggleMessages}     // ← передали
            onCreateClick={() => setCreateOpen(true)} // ← передали
            searchOpen={searchOpen}
            notificationsOpen={notificationsOpen}
            messagesOpen={messagesOpen}          // ← передали (для активного состояния)
          />
        </div>
      </div>

      {/* модалка Create — вызывается и с левой панели, и из футера */}
      <CreatePostModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        token={token}
        currentUser={currentUser}
        onCreated={() => setCreateOpen(false)}
      />
    </div>
  );
}
