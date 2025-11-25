import Link from 'next/link';

interface PostCardProps {
    post: {
        _id: string;
        content: string;
        author: {
            _id: string;
            userId: string;
            name: string;
        };
        createdAt: string;
    };
}

export default function PostCard({ post }: PostCardProps) {
    const formattedDate = new Date(post.createdAt).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div className="bg-white shadow-md rounded-lg p-4 mb-4 border border-gray-200">
            <Link href={`/posts/${post._id}`} className="block">
                <h2 className="text-xl font-semibold text-gray-800 hover:text-blue-600 cursor-pointer">
                    {post.content.substring(0, 100)}{post.content.length > 100 ? '...' : ''}
                </h2>
            </Link>
            <p className="text-gray-600 text-sm mt-2">
                Posted by <span className="font-medium">{post.author.name} ({post.author.userId})</span> on {formattedDate}
            </p>
            {/* Add more post details here if needed */}
        </div>
    );
}
