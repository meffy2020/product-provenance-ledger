'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import Link from 'next/link';

interface Product {
    _id: string;
    productName: string;
    description: string;
    price: number;
    seller: {
        _id: string;
        userId: string;
        name: string;
    };
    createdAt: string;
}

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await api.get('/products');
                setProducts(response.data.products || []);
            } catch (err) {
                setError('Failed to fetch products.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    if (loading) {
        return <div className="text-center py-8">Loading products...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-500">{error}</div>;
    }

    return (
        <div className="py-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">All Products</h1>
            {products.length === 0 ? (
                <p className="text-gray-600">No products available.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((product) => (
                        <div key={product._id} className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-800 mb-2">{product.productName}</h2>
                            <p className="text-gray-600 mb-3">{product.description.substring(0, 100)}{product.description.length > 100 ? '...' : ''}</p>
                            <p className="text-lg font-bold text-green-600 mb-3">${product.price.toFixed(2)}</p>
                            <p className="text-gray-500 text-sm">Seller: {product.seller.name} ({product.seller.userId})</p>
                            {/* You can add a link to a single product page here if needed */}
                            {/* <Link href={`/products/${product._id}`} className="text-blue-500 hover:underline mt-2 block">View Details</Link> */}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
