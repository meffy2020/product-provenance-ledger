'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
    const { isAuthenticated, user, logout } = useAuth();

    return (
        <nav className="bg-gray-800 text-white p-4 shadow-md">
            <div className="container mx-auto flex justify-between items-center">
                <Link href="/" className="text-2xl font-bold text-white hover:text-gray-300">
                    Cocosj
                </Link>
                <div className="flex items-center space-x-4">
                    <Link href="/" className="hover:text-gray-300">Home</Link>
                    <Link href="/posts" className="hover:text-gray-300">Posts</Link>
                    <Link href="/products" className="hover:text-gray-300">Products</Link>
                    {isAuthenticated ? (
                        <>
                            <span className="font-semibold">Welcome, {user?.userId || 'User'}</span>
                            <button
                                onClick={logout}
                                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
                                Login
                            </Link>
                            <Link href="/signup" className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">
                                Sign Up
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
