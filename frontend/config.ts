// API Configuration
// Uses environment variable VITE_API_URL in production, falls back to localhost for development
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
