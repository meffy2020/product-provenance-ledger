import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3000', // 백엔드 API 주소
    headers: {
        'Content-Type': 'application/json',
    },
});

// 요청 인터셉터를 사용하여 모든 요청에 JWT 토큰 추가
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;
