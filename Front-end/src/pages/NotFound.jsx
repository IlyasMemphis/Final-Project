import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/notfound.module.css";

export default function NotFound() {
  const navigate = useNavigate();

  const goHome = () => navigate("/");
  const goBack = () => navigate(-1);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.content}>
          {/* Phones mock */}
          <div className={styles.phones}>
            <div className={`${styles.phone} ${styles.phoneBack}`}>
              <div className={styles.screen}>
                <div className={styles.storyRow}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span className={styles.story} key={i} />
                  ))}
                </div>
                <div className={styles.feedBlock} />
                <div className={styles.feedBlockSmall} />
              </div>
            </div>

            <div className={`${styles.phone} ${styles.phoneFront}`}>
              <div className={styles.screen}>
                <div className={styles.storyRow}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span className={styles.story} key={i} />
                  ))}
                </div>
                <div className={styles.feedBlock} />
                <div className={styles.feedBlockSmall} />
              </div>
            </div>
          </div>

          {/* Text */}
          <div className={styles.textCol}>
            <h1 className={styles.title}>Oops! Page Not Found (404 Error)</h1>
            <p className={styles.desc}>
              We’re sorry, but the page you’re looking for doesn’t seem to exist.
              If you typed the URL manually, please double-check the spelling.
              If you clicked on a link, it may be outdated or broken.
            </p>

            <div className={styles.actions}>
              <button className={styles.primary} onClick={goHome}>Go home</button>
              <button className={styles.ghost} onClick={goBack}>Back</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
