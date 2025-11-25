'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import PostCard from '@/components/PostCard';

interface Post {
    _id: string;
    content: string;
    author: {
        _id: string;
        userId: string;
        name: string;
    };
    createdAt: string;
}

export default function HomePage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPosts = async () => {
            try {
                const response = await api.get('/posts');
                setPosts(response.data.posts || []);
            } catch (err) {
                setError('Failed to fetch posts.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchPosts();
    }, []);

    if (loading) {
        return <div className="text-center py-8">Loading posts...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-500">{error}</div>;
    }

    return (
        <div className="py-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Recent Posts</h1>
            {posts.length === 0 ? (
                <p className="text-gray-600">No posts available. Be the first to create one!</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {posts.map((post) => (
                        <PostCard key={post._id} post={post} />
                    ))}
                </div>
            )}
        </div>
    );
}
