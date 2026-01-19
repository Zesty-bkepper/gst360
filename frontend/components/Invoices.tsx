import React, { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from './Button';
import { ICONS } from '../constants';

interface ExtractedData {
  invoice_id: string | null;
  amount: string | null;
  date: string | null;
  confidence: string | null;
}

interface Invoice {
  id: number;
  filename: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  invoice_number?: string;
  gst_amount?: string;
  invoice_date?: string;
  extracted_data?: { verified?: boolean; [key: string]: any };
}

interface Business {
  id: number;
  business_name: string;
  email: string;
  gstn: string;
}

interface VerificationState {
  documentId: number;
  invoiceId: string;
  amount: string;
  date: string;
  amountConfirmed: boolean;
  dateConfirmed: boolean;
  isEditing: boolean;
}

const API_BASE = 'http://localhost:8000';

const Invoices: React.FC = () => {
  const [searchParams] = useSearchParams();
  const businessId = searchParams.get('business_id') || '1';

  const [business, setBusiness] = useState<Business | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [verificationStates, setVerificationStates] = useState<Map<number, VerificationState>>(new Map());
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const bizResponse = await fetch(`${API_BASE}/api/businesses/${businessId}`);
        if (bizResponse.ok) {
          setBusiness(await bizResponse.json());
        }

        const docsResponse = await fetch(`${API_BASE}/api/businesses/${businessId}/documents`);
        if (docsResponse.ok) {
          const docs = await docsResponse.json();
          setInvoices(docs);

          // Initialize verification states for completed documents that aren't verified yet
          const states = new Map<number, VerificationState>();
          docs.forEach((doc: Invoice) => {
            if (doc.status === 'completed' && !doc.extracted_data?.verified) {
              states.set(doc.id, {
                documentId: doc.id,
                invoiceId: doc.invoice_number || '',
                amount: doc.gst_amount || '',
                date: doc.invoice_date ? doc.invoice_date.split('T')[0] : '',
                amountConfirmed: false,
                dateConfirmed: false,
                isEditing: false,
              });
            }
          });
          setVerificationStates(states);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [businessId]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;

    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`${API_BASE}/api/businesses/${businessId}/documents`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const newDoc = await response.json();
          setInvoices(prev => [newDoc, ...prev]);

          // Auto-process after upload
          setProcessingIds(prev => new Set(prev).add(newDoc.id));

          setTimeout(async () => {
            try {
              const processResponse = await fetch(`${API_BASE}/api/documents/${newDoc.id}/process`, {
                method: 'PATCH',
              });

              if (processResponse.ok) {
                const result = await processResponse.json();

                // Refresh the document
                const docResponse = await fetch(`${API_BASE}/api/documents/${newDoc.id}`);
                if (docResponse.ok) {
                  const updatedDoc = await docResponse.json();
                  setInvoices(prev => prev.map(inv =>
                    inv.id === newDoc.id ? updatedDoc : inv
                  ));

                  // Set up verification state
                  if (updatedDoc.status === 'completed') {
                    setVerificationStates(prev => {
                      const newStates = new Map(prev);
                      newStates.set(updatedDoc.id, {
                        documentId: updatedDoc.id,
                        invoiceId: updatedDoc.invoice_number || '',
                        amount: updatedDoc.gst_amount || '',
                        date: updatedDoc.invoice_date ? updatedDoc.invoice_date.split('T')[0] : '',
                        amountConfirmed: false,
                        dateConfirmed: false,
                        isEditing: false,
                      });
                      return newStates;
                    });
                  }
                }
              }
            } catch (e) {
              console.error('Failed to process:', e);
            } finally {
              setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(newDoc.id);
                return next;
              });
            }
          }, 1000);
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

  const updateVerificationState = (docId: number, updates: Partial<VerificationState>) => {
    setVerificationStates(prev => {
      const newStates = new Map(prev);
      const current = newStates.get(docId);
      if (current) {
        newStates.set(docId, { ...current, ...updates });
      }
      return newStates;
    });
  };

  const confirmInvoice = async (docId: number) => {
    const state = verificationStates.get(docId);
    if (!state) return;

    try {
      const response = await fetch(`${API_BASE}/api/documents/${docId}/confirm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_number: state.invoiceId,
          gst_amount: state.amount,
          invoice_date: state.date,
        }),
      });

      if (response.ok) {
        // Remove from verification states (mark as verified)
        setVerificationStates(prev => {
          const newStates = new Map(prev);
          newStates.delete(docId);
          return newStates;
        });

        // Update invoice in list
        setInvoices(prev => prev.map(inv =>
          inv.id === docId ? {
            ...inv,
            extracted_data: { ...inv.extracted_data, verified: true },
            invoice_number: state.invoiceId,
            gst_amount: state.amount
          } : inv
        ));
      }
    } catch (error) {
      console.error('Failed to confirm:', error);
    }
  };

  const deleteInvoice = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/documents/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setInvoices(prev => prev.filter(inv => inv.id !== id));
        setVerificationStates(prev => {
          const newStates = new Map(prev);
          newStates.delete(id);
          return newStates;
        });
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading invoices...</p>
        </div>
      </div>
    );
  }

  const pendingVerification = invoices.filter(inv => verificationStates.has(inv.id));
  const verified = invoices.filter(inv => inv.extracted_data?.verified || (inv.status === 'completed' && !verificationStates.has(inv.id)));
  const processing = invoices.filter(inv => inv.status === 'pending' || inv.status === 'processing' || processingIds.has(inv.id));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <ICONS.Logo360 className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">GST360</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link to={`/dashboard?business_id=${businessId}`} className="text-sm text-slate-600 hover:text-blue-600 font-medium">
              Dashboard
            </Link>
            <div className="px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
              <span className="text-sm font-semibold text-blue-600">
                {business?.business_name || 'Business'}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Invoice Management</h1>
          <p className="text-slate-600 mt-1">Upload, verify, and manage your invoices & receipts</p>
        </div>

        {/* Upload Section */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Upload Invoice/Receipt</h2>
          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
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
              {isDragging ? 'Drop files here' : 'Click or drag files to upload'}
            </p>
            <p className="text-sm text-slate-500">Supports: JPG, PNG, GIF, WebP, PDF</p>
          </div>
        </div>

        {/* Processing Section */}
        {processing.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
              Processing ({processing.length})
            </h2>
            <div className="space-y-3">
              {processing.map(inv => (
                <div key={inv.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                    <svg className="animate-spin w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <div className="flex-grow">
                    <p className="font-semibold text-slate-900">{inv.filename}</p>
                    <p className="text-sm text-slate-500">Extracting invoice data...</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Verification Section */}
        {pendingVerification.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Pending Verification ({pendingVerification.length})
            </h2>
            <div className="space-y-4">
              {pendingVerification.map(inv => {
                const state = verificationStates.get(inv.id);
                if (!state) return null;

                return (
                  <div key={inv.id} className="bg-white rounded-3xl border border-blue-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-blue-50/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <ICONS.FileText className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{inv.filename}</p>
                            <p className="text-sm text-slate-500">
                              {formatFileSize(inv.file_size)} • Uploaded {new Date(inv.uploaded_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => updateVerificationState(inv.id, { isEditing: !state.isEditing })}
                          className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
                        >
                          {state.isEditing ? 'Cancel Edit' : 'Edit Values'}
                        </button>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="grid lg:grid-cols-2 gap-6">
                        {/* Invoice Image Preview */}
                        <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-center min-h-[300px]">
                          {inv.file_type.startsWith('image/') ? (
                            <img
                              src={`${API_BASE}/api/documents/${inv.id}/file`}
                              alt={inv.filename}
                              className="max-w-full max-h-[400px] rounded-xl shadow-lg object-contain"
                            />
                          ) : (
                            <div className="text-center">
                              <ICONS.FileText className="w-16 h-16 text-slate-400 mx-auto mb-2" />
                              <p className="text-slate-500 text-sm">PDF Preview</p>
                              <a
                                href={`${API_BASE}/api/documents/${inv.id}/file`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 text-sm hover:underline mt-2 inline-block"
                              >
                                Open PDF
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Extracted Data */}
                        <div>
                          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Extracted Data - Please Verify</p>

                          <div className="space-y-4">
                            {/* Invoice ID */}
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-slate-700">Invoice ID</label>
                              {state.isEditing ? (
                                <input
                                  type="text"
                                  value={state.invoiceId}
                                  onChange={(e) => updateVerificationState(inv.id, { invoiceId: e.target.value })}
                                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                />
                              ) : (
                                <p className="px-4 py-3 bg-slate-50 rounded-xl font-medium text-slate-900">
                                  {state.invoiceId || 'Not detected'}
                                </p>
                              )}
                            </div>

                            {/* Amount */}
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-slate-700">Amount</label>
                              {state.isEditing ? (
                                <input
                                  type="text"
                                  value={state.amount}
                                  onChange={(e) => updateVerificationState(inv.id, { amount: e.target.value })}
                                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                />
                              ) : (
                                <div className="flex items-center gap-3">
                                  <p className={`flex-grow px-4 py-3 rounded-xl font-medium ${
                                    state.amountConfirmed ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-50 text-slate-900'
                                  }`}>
                                    {state.amount || 'Not detected'}
                                  </p>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={state.amountConfirmed}
                                      onChange={(e) => updateVerificationState(inv.id, { amountConfirmed: e.target.checked })}
                                      className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                    />
                                    <span className="text-sm text-slate-600">Correct</span>
                                  </label>
                                </div>
                              )}
                            </div>

                            {/* Date */}
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-slate-700">Date</label>
                              {state.isEditing ? (
                                <input
                                  type="date"
                                  value={state.date}
                                  onChange={(e) => updateVerificationState(inv.id, { date: e.target.value })}
                                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                />
                              ) : (
                                <div className="flex items-center gap-3">
                                  <p className={`flex-grow px-4 py-3 rounded-xl font-medium ${
                                    state.dateConfirmed ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-50 text-slate-900'
                                  }`}>
                                    {state.date || 'Not detected'}
                                  </p>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={state.dateConfirmed}
                                      onChange={(e) => updateVerificationState(inv.id, { dateConfirmed: e.target.checked })}
                                      className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                    />
                                    <span className="text-sm text-slate-600">Correct</span>
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-100">
                        <p className="text-sm text-slate-500">
                          {state.amountConfirmed && state.dateConfirmed
                            ? '✓ All fields verified'
                            : 'Please verify amount and date are correct, or edit if needed'}
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => deleteInvoice(inv.id)}
                            className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            Delete
                          </button>
                          <Button
                            variant="primary"
                            onClick={() => confirmInvoice(inv.id)}
                            disabled={!state.isEditing && (!state.amountConfirmed || !state.dateConfirmed)}
                            className={`px-6 py-2 ${
                              (!state.isEditing && (!state.amountConfirmed || !state.dateConfirmed))
                                ? 'opacity-50 cursor-not-allowed'
                                : ''
                            }`}
                          >
                            Confirm & Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Verified Invoices */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <ICONS.CheckCircle className="w-5 h-5 text-green-600" />
            Verified Invoices ({verified.length})
          </h2>

          {verified.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <ICONS.FileText className="w-10 h-10 text-slate-400" />
              </div>
              <p className="text-slate-900 font-semibold mb-1">No verified invoices yet</p>
              <p className="text-sm text-slate-500">Upload and verify invoices to see them here</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice</th>
                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice ID</th>
                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {verified.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                            <ICONS.FileText className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 truncate max-w-[200px]">{inv.filename}</p>
                            <p className="text-xs text-slate-500">{formatFileSize(inv.file_size)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-slate-700">{inv.invoice_number || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900">{inv.gst_amount || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-700">
                          {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-semibold">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                          Verified
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => deleteInvoice(inv.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Invoices;
