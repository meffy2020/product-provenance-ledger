'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { jwtDecode } from 'jwt-decode'; // Use a robust library to decode JWT

// Install jwt-decode: npm install jwt-decode

interface User {
    _id: string;
    userId: string;
}

interface AuthContextType {
    user: User | null;
    login: (token: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded: { _id: string; userId: string } = jwtDecode(token);
                setUser({ _id: decoded._id, userId: decoded.userId || '' });
            } catch (error) {
                console.error("Invalid token:", error);
                localStorage.removeItem('token');
            }
        }
    }, []);

    const login = (token: string) => {
        localStorage.setItem('token', token);
        try {
            const decoded: { _id: string; userId: string } = jwtDecode(token);
            setUser({ _id: decoded._id, userId: decoded.userId || '' });
            router.push('/');
        } catch (error) {
            console.error("Failed to decode token:", error);
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
