import React, { useState } from "react";
import { Link } from "react-router-dom";
import styles from "../styles/forgot.module.css";
import img1 from "../assets/Lock.svg";
import img from "../assets/ICHGRA 2.svg";
import axios from "axios";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [devLink, setDevLink] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setServerError("");
    setSuccessMessage("");
    setDevLink("");
    if (!email.trim()) {
      setServerError("Enter your email");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:3333/api/auth/forgot-password', { email });
      setSuccessMessage(res.data?.message || "Check your email for further instructions");
      if (res.data?.devLink) setDevLink(res.data.devLink); // подсказка в DEV
    } catch (err) {
      setServerError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <form className={styles.form} onSubmit={handleReset}>
          <div>
            <img src={img1} alt="Lock" />
          </div>
          <h2 className={styles.troubleLoginText}>Trouble logging in?</h2>
          <p className={styles.enterEmailText}>
            Enter your email and we'll send you a link to reset your password.
          </p>

          <input
            type="email"
            placeholder="Email"
            className={styles.inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          {serverError && <div style={{ color: "red", marginTop: 8 }}>{serverError}</div>}
          {successMessage && <div style={{ color: "green", marginTop: 8 }}>{successMessage}</div>}

          {devLink && (
            <div style={{ marginTop: 8, fontSize: 14 }}>
              <div style={{ color: "#666" }}>DEV link (SMTP not configured):</div>
              <a href={devLink} style={{ textDecoration: "underline" }}>
                {devLink}
              </a>
            </div>
          )}

          <button type="submit" className={styles.resetBtn} disabled={loading}>
            {loading ? "Sending..." : "Reset your password"}
          </button>

          <div className={styles.divider}>OR</div>
          <Link to='/register' className={styles.createNewAcc}>Create new account</Link>
        </form>

        <div className={styles.boxBackToLogin}>
          <Link to='/login' className={styles.backToLogin}>Back to login</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
