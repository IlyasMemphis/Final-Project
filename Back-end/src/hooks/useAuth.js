import { useEffect, useState } from "react";
import axios from "axios";

const useAuth = () => {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;

        axios.get("http://localhost:3333/api/user/me", {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => setUser(res.data))
        .catch(err => console.error("Ошибка получения профиля:", err));
    }, []);

    return user;
};

export default useAuth;
