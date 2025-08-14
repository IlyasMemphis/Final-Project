import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import styles from "../styles/login.module.css";
import img from "../assets/Background.svg";
import ICHGRAM from "../assets/ICHGRA 2.svg";

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
      const res = await axios.post("/api/auth/login", data);
      console.log('Login succesfull:', res.data);
      localStorage.setItem("token", res.data.token);
      // Сохраняем user в localStorage (это критично для лайков и проч.)
      if (res.data.user) {
        localStorage.setItem("user", JSON.stringify(res.data.user));
      }
      // Тут можно сделать setUser в context/redux если используешь
      navigate("/"); // редирект на главную
    } catch (err) {
      const message =
        err.response?.data?.message || "This user does not exist";
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
