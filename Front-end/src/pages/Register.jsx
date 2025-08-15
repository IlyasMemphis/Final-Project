import React, { useState, useEffect } from "react";
import styles from "../styles/register.module.css";
import img from "../assets/ICHGRA 2.svg";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

const schema = yup.object().shape({
  email: yup.string().email("Invalid email").required("Email is required"),
  fullName: yup.string().required("Full name is required"),
  username: yup.string().required("Username is required"),
  password: yup
    .string()
    .min(6, "Minimum 6 characters")
    .required("Password is required"),
});

export default function Register() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: yupResolver(schema),
  });

  useEffect(() => {
    if (serverError) setServerError("");
  }, [watch()]);

  const onSubmit = async (data) => {
    try {
        setServerError("");
        const res = await axios.post("http://localhost:3333/api/auth/register", data);
        console.log("Registration successful:", res.data);
        navigate("/login");
    } catch (error) {
        if (error.response?.status === 400 && error.response?.data?.message) {
            setServerError(error.response.data.message); // Текст ошибки с бэка
        } else {
            setServerError("Registration failed");
        }
    }
};

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className={styles.registerForm}
        >
          <div>
            <img src={img} alt="ICHGRAM" />
          </div>
          <h3 className={styles.signUpText}>
            Sign up to see photos and videos from your friends.
          </h3>

          <input
            type="text"
            placeholder="Email"
            {...register("email")}
            className={styles.inputClass}
          />
          {errors.email && (
            <p className={styles.error}>{errors.email.message}</p>
          )}

          <input
            type="text"
            placeholder="Full Name"
            {...register("fullName")}
            className={styles.inputClass}
          />
          {errors.fullName && (
            <p className={styles.error}>{errors.fullName.message}</p>
          )}

          <input
            type="text"
            placeholder="Username"
            {...register("username")}
            className={styles.inputClass}
          />
          {errors.username && (
            <p className={styles.error}>{errors.username.message}</p>
          )}

          <input
            type="password"
            placeholder="Password"
            {...register("password")}
            className={styles.inputClass}
          />
          {errors.password && (
            <p className={styles.error}>{errors.password.message}</p>
          )}

          <p className={styles.policy}>
            People who use our service may have uploaded your contact
            information to Instagram.{" "}
            <Link className={styles.links}>Learn More</Link>
          </p>

          <p className={styles.policy}>
            By signing up, you agree to our{" "}
            <Link className={styles.links}>Terms</Link>,{" "}
            <Link className={styles.links}>Privacy Policy</Link> and{" "}
            <Link className={styles.links}>Cookies Policy</Link>
          </p>

          {serverError && (
            <p className={styles.error} style={{ marginBottom: "10px" }}>
              {serverError}
            </p>
          )}

          <button type="submit" className={styles.signUpBtn}>
            Sign up
          </button>
        </form>

        <div className={styles.logIn}>
          <h2 className={styles.haveAnAcc}>Have an account?</h2>
          <Link to="/login" className={styles.links}>
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
