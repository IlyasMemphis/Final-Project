import React from "react";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import styles from "../styles/forgot.module.css"
import img1 from "../assets/Lock.svg"
import img from "../assets/ICHGRA 2.svg"
import axios from "axios";

const ForgotPassword = () => {
    const navigate = useNavigate()
    
    const [email, setEmail] = useState("")
    const [serverError, setServerError] = useState("")
    const [succesMessage, setSuccessMessage] = useState("")
    const [loading, setLoading] = useState(false)

    const handleReset = async (e) => {
        e.preventDefault()
        setServerError("")
        setSuccessMessage("")
        setLoading(true)

        try {
            const res = await axios.post('/api/auth/forgot-password', {email })
            setSuccessMessage(res.data.message || "Check your email for furher instruction")
        } catch (err) {
            setServerError(err.response?.data?.message || "Somthing went wrong")
        } finally {
            setLoading(false)
        }
    }
    
    return (
        <div className={styles.wrapper}>
        <div className={styles.container}>
            <div className={styles.form}>
            <div>
            <img src={img1} alt="Lock" />
            </div>
            <h2 className={styles.troubleLoginText}>Trouble logging in?</h2>
            <p className={styles.enterEmailText}>Enter your email, phone, or username and we'llsend you a link to get back into your account.</p>
            <input type="text" placeholder="Email or Username" className={styles.inputClass}/>
            <button type="submit" className={styles.resetBtn}>Reset your password</button>
            <div className={styles.divider}>OR</div>
            <Link to='/register' className={styles.createNewAcc}>Create new account</Link>
            </div>
            <div className={styles.boxBackToLogin}>
            <Link to='/' className={styles.backToLogin}>Back to login</Link>
            </div>
        </div>
    </div>
)
}

export default ForgotPassword