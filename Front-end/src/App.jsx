import React, { useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";


import Main from "./main/Main.jsx";
import PostCard from "./pages/PostCard.jsx";
import MessagesPage from "./pages/Messages.jsx";

import LeftPanel from "./main/LeftPanel.jsx";
import NotificationsPanel from "./main/NotificationsPanel.jsx";
import SearchPanel from "./main/SearchPanel.jsx";
import MessagesPanelOverlay from "./main/MessagesPanel.jsx";
import Footer from "./main/Footer.jsx";

import ProfilePage from "./pages/ProfilePage.jsx";
import EditProfile from "./pages/EditProfile.jsx";
import NotFound404 from "./pages/NotFound.jsx";

import CreatePostModal from "./pages/CreatePostModal.jsx";   // модалка «Создать пост»
import CreatePage from "./pages/CreatePage.jsx";              // СТРАНИЦА /create (открывает ту же модалку)

function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

/** Лэйаут с левой панелью и футером */
function WithLeftPanel({ children }) {
  const location = useLocation();
  const isMessages = location.pathname.startsWith("/messages");

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false); // локальная модалка Create

  const token = useMemo(() => {
    const raw = localStorage.getItem("token");
    return raw ? String(raw).replace(/^"+|"+$/g, "").trim() : "";
  }, []);
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); }
    catch { return null; }
  }, []);

  const openSearch = () => {
    setSearchOpen(true);
    setNotificationsOpen(false);
    setMessagesOpen(false);
  };
  const toggleNotifications = () => {
    setNotificationsOpen(v => !v);
    if (!notificationsOpen) { setSearchOpen(false); setMessagesOpen(false); }
  };
  const toggleMessages = () => {
    setMessagesOpen(v => !v);
    if (!messagesOpen) { setSearchOpen(false); setNotificationsOpen(false); }
  };

  const closeSearch = () => setSearchOpen(false);
  const closeNotifications = () => setNotificationsOpen(false);
  const closeMessages = () => setMessagesOpen(false);

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
        onCreateClick={() => setCreateOpen(true)}   // кнопка «Create» слева — локальная модалка
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
          ...(isMessages ? { height: "100vh" } : {}),
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
            ...(isMessages
              ? { height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }
              : { overflowY: "auto", WebkitOverflowScrolling: "touch" }),
          }}
        >
          {children}
        </div>

        {/* Оверлеи */}
        {notificationsOpen && (
          <NotificationsPanel onClose={closeNotifications} token={token} currentUser={currentUser} />
        )}
        {searchOpen && (
          <SearchPanel onClose={closeSearch} token={token} currentUser={currentUser} />
        )}
        {messagesOpen && (
          <MessagesPanelOverlay onClose={closeMessages} token={token} currentUser={currentUser} />
        )}

        {/* ФУТЕР */}
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
            searchOpen={searchOpen}
            notificationsOpen={notificationsOpen}
          />
        </div>
      </div>

      {/* Локальная модалка Create (для клика в левой панели) */}
      <CreatePostModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        token={token}
        currentUser={currentUser}
        onCreated={() => {
          setCreateOpen(false);
          // при создании через боковую кнопку можно, например, обновить ленту
          // window.location.reload();
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />

      <Routes>
        {/* публичные */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        

        {/* главные страницы */}
        <Route path="/" element={<PrivateRoute><Main /></PrivateRoute>} />
        <Route path="/explore" element={<PrivateRoute><Main /></PrivateRoute>} />

        {/* СТРАНИЦА СОЗДАНИЯ/РЕДАКТИРОВАНИЯ ПОСТА */}
        {/* /create — чистое создание; /create?edit=<postId> — редактирование */}
        <Route
          path="/create"
          element={
            <PrivateRoute>
              <WithLeftPanel>
                <CreatePage />
              </WithLeftPanel>
            </PrivateRoute>
          }
        />

        {/* сообщения */}
        <Route
          path="/messages"
          element={
            <PrivateRoute>
              <WithLeftPanel><MessagesPage /></WithLeftPanel>
            </PrivateRoute>
          }
        />
        <Route
          path="/messages/:peerId"
          element={
            <PrivateRoute>
              <WithLeftPanel><MessagesPage /></WithLeftPanel>
            </PrivateRoute>
          }
        />

        {/* профиль */}
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <WithLeftPanel><ProfilePage /></WithLeftPanel>
            </PrivateRoute>
          }
        />
        <Route
          path="/profile/:idOrUsername"
          element={
            <PrivateRoute>
              <WithLeftPanel><ProfilePage /></WithLeftPanel>
            </PrivateRoute>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <PrivateRoute>
              <WithLeftPanel><EditProfile /></WithLeftPanel>
            </PrivateRoute>
          }
        />

        {/* пост */}
        <Route
          path="/post/:id"
          element={
            <PrivateRoute>
              <WithLeftPanel><PostCard /></WithLeftPanel>
            </PrivateRoute>
          }
        />

        {/* 404 */}
        <Route
          path="*"
          element={
            <PrivateRoute>
              <WithLeftPanel><NotFound404 /></WithLeftPanel>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
