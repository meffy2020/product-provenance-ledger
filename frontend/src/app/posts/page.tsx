'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import PostCard from '@/components/PostCard';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

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

export default function PostsPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newPostContent, setNewPostContent] = useState('');
    const { isAuthenticated } = useAuth();
    const router = useRouter();

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

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAuthenticated) {
            alert('Please log in to create a post.');
            router.push('/login');
            return;
        }
        if (!newPostContent.trim()) {
            alert('Post content cannot be empty.');
            return;
        }

        try {
            const response = await api.post('/posts', { content: newPostContent });
            setPosts([response.data.post, ...posts]); // Add new post to the top
            setNewPostContent('');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to create post.');
            console.error(err);
        }
    };

    if (loading) {
        return <div className="text-center py-8">Loading posts...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-500">{error}</div>;
    }

    return (
        <div className="py-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">All Posts</h1>

            {isAuthenticated && (
                <div className="bg-white shadow-md rounded-lg p-4 mb-6 border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Create New Post</h2>
                    <form onSubmit={handleCreatePost}>
                        <textarea
                            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            rows={4}
                            placeholder="What's on your mind?"
                            value={newPostContent}
                            onChange={(e) => setNewPostContent(e.target.value)}
                        ></textarea>
                        <button
                            type="submit"
                            className="mt-3 px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            Post
                        </button>
                    </form>
                </div>
            )}

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
