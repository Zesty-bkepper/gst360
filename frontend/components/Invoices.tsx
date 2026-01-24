import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from './Button';
import { ICONS } from '../constants';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';

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
  // GST Compliance Fields (may be at top level or in extracted_data)
  place_of_supply?: string;
  customer_gstin?: string;
  party_name?: string;
  taxable_value?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  state_code?: string;
  gst_rate?: number;
  gst_cess?: number;
  total_invoice_value?: number;
  type_of_supply?: 'B2B' | 'B2C_SMALL' | 'B2C_LARGE';
  extracted_data?: {
    verified?: boolean;
    place_of_supply?: string;
    customer_gstin?: string;
    party_name?: string;
    taxable_value?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    state_code?: string;
    gst_rate?: number;
    gst_cess?: number;
    total_invoice_value?: number;
    type_of_supply?: string;
    [key: string]: any;
  };
}

// Helper to get GST field from invoice (checks both top-level and extracted_data)
function getGstField<T>(invoice: Invoice, field: keyof Invoice): T | undefined {
  const topLevel = invoice[field] as T | undefined;
  if (topLevel !== undefined && topLevel !== null) return topLevel;
  return invoice.extracted_data?.[field as string] as T | undefined;
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
  // GST Compliance Fields
  placeOfSupply: string;
  customerGstin: string;
  partyName: string;
  taxableValue: string;
  cgst: string;
  sgst: string;
  igst: string;
  stateCode: string;
  gstRate: string;
  gstCess: string;
  typeOfSupply: string;
}

const Invoices: React.FC = () => {
  const { user, getAuthHeaders, logout } = useAuth();
  const navigate = useNavigate();
  const businessId = user?.business_id?.toString() || '1';

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
      const headers = getAuthHeaders();

      try {
        const bizResponse = await fetch(`${API_BASE}/api/businesses/${businessId}`, { headers });
        if (bizResponse.ok) {
          setBusiness(await bizResponse.json());
        } else if (bizResponse.status === 401) {
          logout();
          navigate('/login');
          return;
        }

        const docsResponse = await fetch(`${API_BASE}/api/businesses/${businessId}/documents`, { headers });
        if (docsResponse.ok) {
          const docs = await docsResponse.json();
          setInvoices(docs);

          // Initialize verification states for completed documents that aren't verified yet
          const states = new Map<number, VerificationState>();
          docs.forEach((doc: Invoice) => {
            if (doc.status === 'completed' && !doc.extracted_data?.verified) {
              // Get GST fields from either top-level or extracted_data
              const placeOfSupply = getGstField<string>(doc, 'place_of_supply') || '';
              const customerGstin = getGstField<string>(doc, 'customer_gstin') || '';
              const partyName = getGstField<string>(doc, 'party_name') || '';
              const taxableValue = getGstField<number>(doc, 'taxable_value');
              const cgst = getGstField<number>(doc, 'cgst');
              const sgst = getGstField<number>(doc, 'sgst');
              const igst = getGstField<number>(doc, 'igst');
              const stateCode = getGstField<string>(doc, 'state_code') || '';
              const gstRate = getGstField<number>(doc, 'gst_rate');
              const gstCess = getGstField<number>(doc, 'gst_cess');
              const totalValue = getGstField<number>(doc, 'total_invoice_value');
              const typeOfSupply = getGstField<string>(doc, 'type_of_supply') || '';

              states.set(doc.id, {
                documentId: doc.id,
                invoiceId: doc.invoice_number || '',
                amount: totalValue?.toString() || doc.gst_amount || '',
                date: doc.invoice_date ? doc.invoice_date.split('T')[0] : '',
                amountConfirmed: false,
                dateConfirmed: false,
                isEditing: false,
                // GST fields
                placeOfSupply,
                customerGstin,
                partyName,
                taxableValue: taxableValue?.toString() || '',
                cgst: cgst?.toString() || '',
                sgst: sgst?.toString() || '',
                igst: igst?.toString() || '',
                stateCode,
                gstRate: gstRate?.toString() || '',
                gstCess: gstCess?.toString() || '',
                typeOfSupply,
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
          setInvoices(prev => [newDoc, ...prev]);

          // Auto-process after upload
          setProcessingIds(prev => new Set(prev).add(newDoc.id));

          setTimeout(async () => {
            try {
              const processResponse = await fetch(`${API_BASE}/api/documents/${newDoc.id}/process`, {
                method: 'PATCH',
                headers,
              });

              if (processResponse.ok) {
                const result = await processResponse.json();

                // Refresh the document
                const docResponse = await fetch(`${API_BASE}/api/documents/${newDoc.id}`, { headers });
                if (docResponse.ok) {
                  const updatedDoc = await docResponse.json();
                  setInvoices(prev => prev.map(inv =>
                    inv.id === newDoc.id ? updatedDoc : inv
                  ));

                  // Set up verification state
                  if (updatedDoc.status === 'completed') {
                    setVerificationStates(prev => {
                      const newStates = new Map(prev);
                      // Get GST fields from either top-level or extracted_data
                      const placeOfSupply = getGstField<string>(updatedDoc, 'place_of_supply') || '';
                      const customerGstin = getGstField<string>(updatedDoc, 'customer_gstin') || '';
                      const partyName = getGstField<string>(updatedDoc, 'party_name') || '';
                      const taxableValue = getGstField<number>(updatedDoc, 'taxable_value');
                      const cgst = getGstField<number>(updatedDoc, 'cgst');
                      const sgst = getGstField<number>(updatedDoc, 'sgst');
                      const igst = getGstField<number>(updatedDoc, 'igst');
                      const stateCode = getGstField<string>(updatedDoc, 'state_code') || '';
                      const gstRate = getGstField<number>(updatedDoc, 'gst_rate');
                      const gstCess = getGstField<number>(updatedDoc, 'gst_cess');
                      const totalValue = getGstField<number>(updatedDoc, 'total_invoice_value');
                      const typeOfSupply = getGstField<string>(updatedDoc, 'type_of_supply') || '';

                      newStates.set(updatedDoc.id, {
                        documentId: updatedDoc.id,
                        invoiceId: updatedDoc.invoice_number || '',
                        amount: totalValue?.toString() || updatedDoc.gst_amount || '',
                        date: updatedDoc.invoice_date ? updatedDoc.invoice_date.split('T')[0] : '',
                        amountConfirmed: false,
                        dateConfirmed: false,
                        isEditing: false,
                        // GST fields
                        placeOfSupply,
                        customerGstin,
                        partyName,
                        taxableValue: taxableValue?.toString() || '',
                        cgst: cgst?.toString() || '',
                        sgst: sgst?.toString() || '',
                        igst: igst?.toString() || '',
                        stateCode,
                        gstRate: gstRate?.toString() || '',
                        gstCess: gstCess?.toString() || '',
                        typeOfSupply,
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

    const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };

    try {
      const response = await fetch(`${API_BASE}/api/documents/${docId}/confirm`, {
        method: 'PATCH',
        headers,
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
    const headers = getAuthHeaders();

    try {
      const response = await fetch(`${API_BASE}/api/documents/${id}`, {
        method: 'DELETE',
        headers,
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

  const handleLogout = () => {
    logout();
    navigate('/login');
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
            <Link to="/dashboard" className="text-sm text-slate-600 hover:text-blue-600 font-medium">
              Dashboard
            </Link>
            <div className="px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
              <span className="text-sm font-semibold text-blue-600">
                {user?.business_name || business?.business_name || 'Business'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
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
                        <div className="overflow-y-auto max-h-[500px]">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Extracted GST Data</p>
                            {state.typeOfSupply && (
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                state.typeOfSupply === 'B2B'
                                  ? 'bg-purple-100 text-purple-700'
                                  : state.typeOfSupply === 'B2C_LARGE'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {state.typeOfSupply}
                              </span>
                            )}
                          </div>

                          <div className="space-y-3">
                            {/* Invoice Number & Date Row */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Invoice No.</label>
                                {state.isEditing ? (
                                  <input
                                    type="text"
                                    value={state.invoiceId}
                                    onChange={(e) => updateVerificationState(inv.id, { invoiceId: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
                                  />
                                ) : (
                                  <p className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-900">
                                    {state.invoiceId || '-'}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Date</label>
                                {state.isEditing ? (
                                  <input
                                    type="date"
                                    value={state.date}
                                    onChange={(e) => updateVerificationState(inv.id, { date: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
                                  />
                                ) : (
                                  <p className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-900">
                                    {state.date || '-'}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Party Name & GSTIN Row */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Party Name</label>
                                {state.isEditing ? (
                                  <input
                                    type="text"
                                    value={state.partyName}
                                    onChange={(e) => updateVerificationState(inv.id, { partyName: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
                                  />
                                ) : (
                                  <p className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-900 truncate">
                                    {state.partyName || '-'}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Customer GSTIN</label>
                                {state.isEditing ? (
                                  <input
                                    type="text"
                                    value={state.customerGstin}
                                    onChange={(e) => updateVerificationState(inv.id, { customerGstin: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none font-mono"
                                  />
                                ) : (
                                  <p className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-mono text-slate-900">
                                    {state.customerGstin || <span className="text-slate-400 font-sans">B2C (No GSTIN)</span>}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Place of Supply & State Code */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Place of Supply</label>
                                {state.isEditing ? (
                                  <input
                                    type="text"
                                    value={state.placeOfSupply}
                                    onChange={(e) => updateVerificationState(inv.id, { placeOfSupply: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
                                  />
                                ) : (
                                  <p className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-900">
                                    {state.placeOfSupply || '-'}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">State Code</label>
                                {state.isEditing ? (
                                  <input
                                    type="text"
                                    value={state.stateCode}
                                    onChange={(e) => updateVerificationState(inv.id, { stateCode: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
                                  />
                                ) : (
                                  <p className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-900">
                                    {state.stateCode || '-'}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Tax Breakdown Section */}
                            <div className="mt-4 pt-3 border-t border-slate-100">
                              <p className="text-xs font-semibold text-slate-500 mb-2">TAX BREAKDOWN</p>

                              {/* Taxable Value & GST Rate */}
                              <div className="grid grid-cols-2 gap-3 mb-2">
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold text-slate-500">Taxable Value</label>
                                  {state.isEditing ? (
                                    <input
                                      type="text"
                                      value={state.taxableValue}
                                      onChange={(e) => updateVerificationState(inv.id, { taxableValue: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
                                    />
                                  ) : (
                                    <p className="px-3 py-2 bg-blue-50 rounded-lg text-sm font-semibold text-blue-900">
                                      {state.taxableValue ? `₹${parseFloat(state.taxableValue).toLocaleString('en-IN')}` : '-'}
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold text-slate-500">GST Rate</label>
                                  {state.isEditing ? (
                                    <input
                                      type="text"
                                      value={state.gstRate}
                                      onChange={(e) => updateVerificationState(inv.id, { gstRate: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
                                    />
                                  ) : (
                                    <p className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-900">
                                      {state.gstRate ? `${state.gstRate}%` : '-'}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* CGST, SGST, IGST */}
                              <div className="grid grid-cols-3 gap-2 mb-2">
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold text-slate-500">CGST</label>
                                  {state.isEditing ? (
                                    <input
                                      type="text"
                                      value={state.cgst}
                                      onChange={(e) => updateVerificationState(inv.id, { cgst: e.target.value })}
                                      className="w-full px-2 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
                                    />
                                  ) : (
                                    <p className="px-2 py-2 bg-green-50 rounded-lg text-sm font-medium text-green-800 text-center">
                                      {state.cgst ? `₹${parseFloat(state.cgst).toLocaleString('en-IN')}` : '-'}
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold text-slate-500">SGST</label>
                                  {state.isEditing ? (
                                    <input
                                      type="text"
                                      value={state.sgst}
                                      onChange={(e) => updateVerificationState(inv.id, { sgst: e.target.value })}
                                      className="w-full px-2 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
                                    />
                                  ) : (
                                    <p className="px-2 py-2 bg-green-50 rounded-lg text-sm font-medium text-green-800 text-center">
                                      {state.sgst ? `₹${parseFloat(state.sgst).toLocaleString('en-IN')}` : '-'}
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold text-slate-500">IGST</label>
                                  {state.isEditing ? (
                                    <input
                                      type="text"
                                      value={state.igst}
                                      onChange={(e) => updateVerificationState(inv.id, { igst: e.target.value })}
                                      className="w-full px-2 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
                                    />
                                  ) : (
                                    <p className="px-2 py-2 bg-amber-50 rounded-lg text-sm font-medium text-amber-800 text-center">
                                      {state.igst ? `₹${parseFloat(state.igst).toLocaleString('en-IN')}` : '-'}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* GST Cess */}
                              {(state.gstCess || state.isEditing) && (
                                <div className="space-y-1 mb-2">
                                  <label className="text-xs font-semibold text-slate-500">GST Cess</label>
                                  {state.isEditing ? (
                                    <input
                                      type="text"
                                      value={state.gstCess}
                                      onChange={(e) => updateVerificationState(inv.id, { gstCess: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
                                    />
                                  ) : (
                                    <p className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-900">
                                      {state.gstCess ? `₹${parseFloat(state.gstCess).toLocaleString('en-IN')}` : '-'}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Total Invoice Value */}
                              <div className="space-y-1 mt-3 pt-2 border-t border-slate-200">
                                <label className="text-xs font-semibold text-slate-500">TOTAL INVOICE VALUE</label>
                                {state.isEditing ? (
                                  <input
                                    type="text"
                                    value={state.amount}
                                    onChange={(e) => updateVerificationState(inv.id, { amount: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
                                  />
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <p className={`flex-grow px-3 py-2 rounded-lg text-lg font-bold ${
                                      state.amountConfirmed ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-900'
                                    }`}>
                                      {state.amount ? `₹${parseFloat(state.amount).toLocaleString('en-IN')}` : '-'}
                                    </p>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={state.amountConfirmed}
                                        onChange={(e) => updateVerificationState(inv.id, { amountConfirmed: e.target.checked })}
                                        className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                      />
                                      <span className="text-xs text-slate-600">OK</span>
                                    </label>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Date Confirmation (not in edit mode) */}
                            {!state.isEditing && (
                              <div className="flex items-center justify-end gap-2 mt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={state.dateConfirmed}
                                    onChange={(e) => updateVerificationState(inv.id, { dateConfirmed: e.target.checked })}
                                    className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                  />
                                  <span className="text-xs text-slate-600">Date is correct</span>
                                </label>
                              </div>
                            )}
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
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Party / GSTIN</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Taxable</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">CGST</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">SGST</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">IGST</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {verified.map(inv => {
                    // Get GST fields from either top-level or extracted_data
                    const typeOfSupply = getGstField<string>(inv, 'type_of_supply');
                    const partyName = getGstField<string>(inv, 'party_name');
                    const customerGstin = getGstField<string>(inv, 'customer_gstin');
                    const taxableValue = getGstField<number>(inv, 'taxable_value');
                    const cgst = getGstField<number>(inv, 'cgst');
                    const sgst = getGstField<number>(inv, 'sgst');
                    const igst = getGstField<number>(inv, 'igst');
                    const totalInvoiceValue = getGstField<number>(inv, 'total_invoice_value');

                    return (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <ICONS.FileText className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 text-sm truncate max-w-[120px]" title={inv.filename}>
                              {inv.invoice_number || inv.filename}
                            </p>
                            <p className="text-xs text-slate-500">
                              {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN') : '-'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold ${
                          typeOfSupply === 'B2B'
                            ? 'bg-purple-100 text-purple-700'
                            : typeOfSupply === 'B2C_LARGE'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {typeOfSupply || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate max-w-[150px]" title={partyName || ''}>
                            {partyName || '-'}
                          </p>
                          {customerGstin ? (
                            <p className="text-xs font-mono text-slate-500">{customerGstin}</p>
                          ) : (
                            <p className="text-xs text-slate-400">No GSTIN</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-slate-900">
                          {taxableValue ? `₹${taxableValue.toLocaleString('en-IN')}` : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-green-700">
                          {cgst ? `₹${cgst.toLocaleString('en-IN')}` : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-green-700">
                          {sgst ? `₹${sgst.toLocaleString('en-IN')}` : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-amber-700">
                          {igst ? `₹${igst.toLocaleString('en-IN')}` : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-bold text-slate-900">
                          {totalInvoiceValue ? `₹${totalInvoiceValue.toLocaleString('en-IN')}` : (inv.gst_amount || '-')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => deleteInvoice(inv.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    );
                  })}
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
