import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/apiService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem('hs_token'));
    const [loading, setLoading] = useState(true);

    // Fetch profile on mount / token change
    useEffect(() => {
        if (!token) { setLoading(false); return; }
        api.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => setUser(r.data.user))
            .catch(() => { localStorage.removeItem('hs_token'); setToken(null); })
            .finally(() => setLoading(false));
    }, [token]);

    const login = useCallback(async (email, password) => {
        const { data } = await api.post('/api/auth/login', { email, password });
        localStorage.setItem('hs_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    }, []);

    const register = useCallback(async (email, password, full_name) => {
        const { data } = await api.post('/api/auth/register', { email, password, full_name });
        localStorage.setItem('hs_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('hs_token');
        setToken(null);
        setUser(null);
    }, []);

    const refreshUser = useCallback(async () => {
        if (!token) return;
        const { data } = await api.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        setUser(data.user);
    }, [token]);

    const updateToken = useCallback((newToken, newUser) => {
        localStorage.setItem('hs_token', newToken);
        setToken(newToken);
        setUser(newUser || user);
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser, updateToken }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
