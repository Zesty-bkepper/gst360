import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from './Button';
import { ICONS } from '../constants';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';

interface UploadedFile {
  id: number;
  filename: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  gst_amount?: string;
  invoice_number?: string;
}

interface Business {
  id: number;
  business_name: string;
  email: string;
  gstn: string;
  onboarding_status: string;
}

interface DashboardStats {
  total_documents: number;
  processed_documents: number;
  pending_documents: number;
  total_gst: string;
}

const Dashboard: React.FC = () => {
  const { user, getAuthHeaders, logout } = useAuth();
  const navigate = useNavigate();
  const businessId = user?.business_id?.toString() || '1';

  const [business, setBusiness] = useState<Business | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total_documents: 0,
    processed_documents: 0,
    pending_documents: 0,
    total_gst: '₹0.00'
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch business data
  useEffect(() => {
    const fetchData = async () => {
      const headers = getAuthHeaders();

      try {
        // Fetch business info
        const bizResponse = await fetch(`${API_BASE}/api/businesses/${businessId}`, { headers });
        if (bizResponse.ok) {
          const bizData = await bizResponse.json();
          setBusiness(bizData);
        } else if (bizResponse.status === 401) {
          logout();
          navigate('/login');
          return;
        }

        // Fetch documents
        const docsResponse = await fetch(`${API_BASE}/api/businesses/${businessId}/documents`, { headers });
        if (docsResponse.ok) {
          const docsData = await docsResponse.json();
          setFiles(docsData);
        }

        // Fetch dashboard stats
        const statsResponse = await fetch(`${API_BASE}/api/businesses/${businessId}/dashboard`, { headers });
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [businessId, getAuthHeaders, logout, navigate]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;

    const headers = getAuthHeaders();

    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`${API_BASE}/api/businesses/${businessId}/documents`, {
          method: 'POST',
          headers,
          body: formData,
        });

        if (response.ok) {
          const newDoc = await response.json();
          setFiles(prev => [newDoc, ...prev]);
          setStats(prev => ({
            ...prev,
            total_documents: prev.total_documents + 1,
            pending_documents: prev.pending_documents + 1
          }));

          // Process after upload
          setTimeout(async () => {
            try {
              await fetch(`${API_BASE}/api/documents/${newDoc.id}/process`, {
                method: 'PATCH',
                headers,
              });
              // Refresh documents
              const docsResponse = await fetch(`${API_BASE}/api/businesses/${businessId}/documents`, { headers });
              if (docsResponse.ok) {
                const docsData = await docsResponse.json();
                setFiles(docsData);
              }
              // Refresh stats
              const statsResponse = await fetch(`${API_BASE}/api/businesses/${businessId}/dashboard`, { headers });
              if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                setStats(statsData);
              }
            } catch (e) {
              console.error('Failed to process document:', e);
            }
          }, 2000);
        }
      } catch (error) {
        console.error('Failed to upload:', error);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeFile = async (id: number) => {
    const headers = getAuthHeaders();

    try {
      const response = await fetch(`${API_BASE}/api/documents/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (response.ok) {
        setFiles(prev => prev.filter(f => f.id !== id));
        // Refresh stats
        const statsResponse = await fetch(`${API_BASE}/api/businesses/${businessId}/dashboard`, { headers });
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Dashboard Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <ICONS.Logo360 className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">GST360</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              to="/invoices"
              className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
            >
              Invoices
            </Link>
            <div className="px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
              <span className="text-sm font-semibold text-blue-600">
                {user?.business_name || business?.business_name || 'Business'}
              </span>
            </div>
            <div className="px-3 py-1.5 bg-green-50 rounded-lg border border-green-100">
              <span className="text-xs font-bold text-green-600 uppercase">
                {business?.onboarding_status || 'Active'}
              </span>
            </div>
            <Button variant="ghost" size="sm" className="text-slate-600" onClick={handleLogout}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">
            Upload and manage your invoices & receipts
            {business?.gstn && <span className="ml-2 text-sm text-slate-400">GSTN: {business.gstn}</span>}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                <ICONS.FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.total_documents}</p>
                <p className="text-sm text-slate-500">Total Uploads</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center">
                <ICONS.CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.processed_documents}</p>
                <p className="text-sm text-slate-500">Processed</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                <ICONS.Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.pending_documents}</p>
                <p className="text-sm text-slate-500">Processing</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center">
                <ICONS.Analysis className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.total_gst}</p>
                <p className="text-sm text-slate-500">Total GST</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm sticky top-24">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Upload Documents</h2>

              <div
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />

                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ICONS.Plus className="w-8 h-8 text-blue-600" />
                </div>

                <p className="text-slate-900 font-semibold mb-1">
                  {isDragging ? 'Drop files here' : 'Click or drag files'}
                </p>
                <p className="text-sm text-slate-500">
                  Supports: JPG, PNG, GIF, WebP, PDF
                </p>
              </div>

              <div className="mt-6 p-4 bg-slate-50 rounded-2xl">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Accepted Formats</h3>
                <div className="flex flex-wrap gap-2">
                  {['JPG', 'PNG', 'GIF', 'WebP', 'PDF'].map(format => (
                    <span
                      key={format}
                      className="px-3 py-1 bg-white rounded-lg text-xs font-medium text-slate-600 border border-slate-200"
                    >
                      {format}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Files List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">Recent Uploads</h2>
                  {files.length > 0 && (
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold">
                      {files.length} files
                    </span>
                  )}
                </div>
              </div>

              {files.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <ICONS.FileText className="w-10 h-10 text-slate-400" />
                  </div>
                  <p className="text-slate-900 font-semibold mb-1">No uploads yet</p>
                  <p className="text-sm text-slate-500">
                    Upload invoices or receipts to get started
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {files.map(file => (
                    <div key={file.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        {/* Preview */}
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0">
                          <ICONS.FileText className="w-8 h-8 text-slate-400" />
                        </div>

                        {/* Info */}
                        <div className="flex-grow min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{file.filename}</p>
                          <p className="text-sm text-slate-500">
                            {formatFileSize(file.file_size)} • {new Date(file.uploaded_at).toLocaleString()}
                          </p>
                          {file.invoice_number && (
                            <p className="text-xs text-blue-600 font-medium mt-1">
                              Invoice: {file.invoice_number} • GST: {file.gst_amount}
                            </p>
                          )}
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-3">
                          {file.status === 'pending' || file.status === 'processing' ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full">
                              <svg className="animate-spin w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <span className="text-xs font-semibold text-amber-600">Processing</span>
                            </div>
                          ) : file.status === 'completed' ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
                              <ICONS.CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-xs font-semibold text-green-600">Completed</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-full">
                              <span className="text-xs font-semibold text-red-600">Error</span>
                            </div>
                          )}

                          <button
                            onClick={() => removeFile(file.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
