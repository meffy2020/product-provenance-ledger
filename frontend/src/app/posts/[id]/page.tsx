'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
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

interface Comment {
    _id: string;
    content: string;
    author: {
        _id: string;
        userId: string;
        name: string;
    };
    createdAt: string;
    likes: number;
}

export default function SinglePostPage() {
    const { id } = useParams();
    const [post, setPost] = useState<Post | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newCommentContent, setNewCommentContent] = useState('');
    const { isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!id) return;

        const fetchPostAndComments = async () => {
            try {
                const postResponse = await api.get(`/posts/${id}`);
                setPost(postResponse.data.post);

                const commentsResponse = await api.get(`/posts/${id}/comments`);
                setComments(commentsResponse.data.comments);
            } catch (err) {
                setError('Failed to fetch post or comments.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchPostAndComments();
    }, [id]);

    const handleCreateComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAuthenticated) {
            alert('Please log in to comment.');
            router.push('/login');
            return;
        }
        if (!newCommentContent.trim()) {
            alert('Comment content cannot be empty.');
            return;
        }

        try {
            const response = await api.post(`/posts/${id}/comments`, { content: newCommentContent });
            setComments([response.data.comment, ...comments]); // Add new comment to the top
            setNewCommentContent('');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to create comment.');
            console.error(err);
        }
    };

    const handleLikeComment = async (commentId: string) => {
        if (!isAuthenticated) {
            alert('Please log in to like a comment.');
            router.push('/login');
            return;
        }
        try {
            const response = await api.post(`/comments/${commentId}/like`);
            setComments(comments.map(comment =>
                comment._id === commentId ? { ...comment, likes: response.data.likes } : comment
            ));
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to like comment.');
            console.error(err);
        }
    };

    if (loading) {
        return <div className="text-center py-8">Loading post...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-500">{error}</div>;
    }

    if (!post) {
        return <div className="text-center py-8">Post not found.</div>;
    }

    const formattedPostDate = new Date(post.createdAt).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div className="py-8">
            <div className="bg-white shadow-md rounded-lg p-6 mb-6 border border-gray-200">
                <h1 className="text-3xl font-bold text-gray-800 mb-4">{post.content}</h1>
                <p className="text-gray-600 text-sm mb-4">
                    Posted by <span className="font-medium">{post.author.name} ({post.author.userId})</span> on {formattedPostDate}
                </p>
            </div>

            <div className="bg-white shadow-md rounded-lg p-6 mb-6 border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Comments</h2>
                {isAuthenticated && (
                    <form onSubmit={handleCreateComment} className="mb-6">
                        <textarea
                            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            rows={3}
                            placeholder="Write a comment..."
                            value={newCommentContent}
                            onChange={(e) => setNewCommentContent(e.target.value)}
                        ></textarea>
                        <button
                            type="submit"
                            className="mt-3 px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            Add Comment
                        </button>
                    </form>
                )}

                {comments.length === 0 ? (
                    <p className="text-gray-600">No comments yet. Be the first to comment!</p>
                ) : (
                    <div className="space-y-4">
                        {comments.map((comment) => (
                            <div key={comment._id} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                <p className="text-gray-800">{comment.content}</p>
                                <div className="flex justify-between items-center text-sm text-gray-500 mt-2">
                                    <span>
                                        By <span className="font-medium">{comment.author.name} ({comment.author.userId})</span> on {new Date(comment.createdAt).toLocaleDateString('ko-KR')}
                                    </span>
                                    <div className="flex items-center space-x-2">
                                        <span>Likes: {comment.likes}</span>
                                        <button
                                            onClick={() => handleLikeComment(comment._id)}
                                            className="text-blue-500 hover:text-blue-700"
                                        >
                                            Like
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
