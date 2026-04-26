import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import styles from "../styles/login.module.css";
import img from "../assets/Background.svg";
import ICHGRAM from "../assets/ICHGRA 2.svg";
import http from "../config/http";

// ✅ Схема валидации через yup
const schema = yup.object().shape({
  email: yup
    .string()
    .required("Enter your email or username")
    .matches(/^[^\s]+$/, "No spaces allowed"),
  password: yup
    .string()
    .required("Enter your password")
    .min(6, "Minimum 6 characters")
});

const Login = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  // useForm + yupResolver
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: yupResolver(schema)
  });

  const email = watch("email");
  const password = watch("password");

  useEffect(() => {
    if (serverError) setServerError('');
  }, [email, password]);

  // логика логина
  const onSubmit = async (data) => {
    try {
      setServerError("");
      // !! Важно: ждем и токен, и user
      const res = await http.post("/api/auth/login", data);
      console.log('Login succesfull:', res.data);
      localStorage.setItem("token", res.data.token);
      if (res.data.user) {
        const normalizedUser = {
          ...res.data.user,
          _id: res.data.user._id || res.data.user.id || res.data.user.userId || "",
          id: res.data.user.id || res.data.user._id || res.data.user.userId || "",
        };
        localStorage.setItem("user", JSON.stringify(normalizedUser));
      }
      toast.success("Successfully signed in", { position: "top-center" });
      navigate("/"); // редирект на главную
    } catch (err) {
      const message =
        err.response?.data?.message || "Cannot connect to server. Check backend URL.";
      setServerError(message);
      console.error("Login failed:", err.response?.data?.message || "Unknown error");
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        {/* Левая часть */}
        <div className={styles.left}>
          <img src={img} alt="phones" />
        </div>

        {/* Правая часть */}
        <div className={styles.right}>
          <form onSubmit={handleSubmit(onSubmit)} className={styles.formBox}>
            <div>
              <img src={ICHGRAM} alt="ICHGRAM" />
            </div>

            {/* email/username */}
            <input
              type="text"
              placeholder="Username, or email"
              {...register("email")}
              className={styles.inputClass}
            />
            {errors.email && <p className={styles.error}>{errors.email.message}</p>}

            {/* пароль */}
            <input
              type="password"
              placeholder="Password"
              {...register("password")}
              className={styles.inputClass}
            />
            {errors.password && <p className={styles.error}>{errors.password.message}</p>}

            {serverError && (
              <p style={{ color: "red", marginBottom: "10px" }}>
                {serverError}
              </p>
            )}
            <button type="submit" className={styles.signUpBtn}>Sign In</button>
            <div className={styles.divider}>OR</div>
            <Link to="/forgot-password" className={styles.forgot}>
              Forgot password?
            </Link>
          </form>

          <div className={styles.signupBox}>
            <p className={styles.noAccount}>Don't have an account?</p>
            <Link to="/register" className={styles.underline}>Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
