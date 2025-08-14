import React, { useEffect, useState } from "react";
import PostCard from "./PostCard";
import styles from '../styles/feed.module.css';
import checkmark from "../assets/check mark.svg"

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const currentUser = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetch("/api/posts", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.json())
      .then(setPosts);
  }, [token]);

  if (!posts.length) return <div>Нет постов</div>;

  return (
<>
  <div className={styles.grid}>
    {posts.map((post) => (
      <PostCard
        key={post._id}
        post={post}
        currentUser={currentUser}
        token={token}
      />
    ))}
  </div>
  <div className={styles.allUpdates}>
    <img src={checkmark} alt="" className={styles.checkIcon} />
    <div className={styles.title}>You’ve seen all the updates</div>
    <div className={styles.text}>You’ve viewed all the publications.</div>
  </div>
</>

  );
}
