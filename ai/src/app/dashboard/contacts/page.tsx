/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { ConfirmModal } from '@/components/dashboard/shared/ConfirmModal';
import { CustomSelect } from '@/components/dashboard/shared/CustomSelect';
import { EmptyState } from '@/components/EmptyState';
import { Search, Plus, Upload, Download, Trash2, Edit2, MoreVertical, X, PhoneOff, Phone, Loader2 } from 'lucide-react';
import '@/styles/dashboard.css';

interface Contact {
  id: number;
  first_name: string;
  last_name?: string;
  company?: string;
  phone: string;
  email?: string;
  status: string;
  tags: string[];
  do_not_call: number;
  created_at: string;
  last_called_at?: string;
}

export default function ContactsPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    company: '',
    phone: '',
    email: '',
    status: 'active',
  });

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const limit = 10;

  useEffect(() => {
    if (token) {
      fetchContacts();
    }
  }, [token, page, search, statusFilter]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });
      
      const res = await api(`/contacts?${query.toString()}`, { token: token || undefined });
      if (res) {
        const contactList = Array.isArray(res?.data?.contacts)
          ? res.data.contacts
          : (Array.isArray(res?.contacts)
            ? res.contacts
            : (Array.isArray(res?.data)
              ? res.data
              : (Array.isArray(res) ? res : [])));
        const totalCount = res?.data?.total ?? res?.total ?? contactList.length;
        setContacts(Array.isArray(contactList) ? contactList : []);
        setTotal(Number(totalCount) || 0);
      }
    } catch (err) {
      console.error('Failed to load contacts', err);
      setContacts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name.trim() || !formData.phone.trim()) {
      addToast('First name and phone number are required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingContact) {
        await api(`/contacts/${editingContact.id}`, { method: 'PUT', body: formData, token });
        addToast('Contact updated successfully', 'success');
      } else {
        await api('/contacts', { method: 'POST', body: formData, token });
        addToast('Contact created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchContacts();
    } catch (err: any) {
      console.error('Failed to save contact', err);
      addToast(err?.message || 'Failed to save contact. Check phone format.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/contacts/${deleteTarget.id}`, { method: 'DELETE', token });
      addToast(`Contact "${deleteTarget.first_name}" deleted`, 'success');
      setDeleteTarget(null);
      fetchContacts();
    } catch (err) {
      console.error('Delete failed', err);
      addToast('Failed to delete contact', 'error');
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    try {
      await api('/contacts/bulk-delete', { method: 'POST', body: { ids: Array.from(selectedIds) }, token });
      addToast(`${count} contacts deleted`, 'success');
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
      fetchContacts();
    } catch (err) {
      console.error('Bulk delete failed', err);
      addToast('Failed to delete selected contacts', 'error');
    }
  };

  const toggleDnc = async (contact: Contact) => {
    try {
      if (contact.do_not_call) {
        await api(`/contacts/${contact.id}/dnc`, { method: 'DELETE', token });
        addToast(`Removed ${contact.first_name} from Do Not Call list`, 'info');
      } else {
        await api(`/contacts/${contact.id}/dnc`, { method: 'POST', body: { reason: 'Manual toggle' }, token });
        addToast(`Added ${contact.first_name} to Do Not Call list`, 'info');
      }
      fetchContacts();
    } catch (err) {
      console.error('Failed to toggle DNC', err);
      addToast('Failed to toggle DNC status', 'error');
    }
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      first_name: contact.first_name,
      last_name: contact.last_name || '',
      company: contact.company || '',
      phone: contact.phone,
      email: contact.email || '',
      status: contact.status,
    });
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingContact(null);
    setFormData({
      first_name: '',
      last_name: '',
      company: '',
      phone: '',
      email: '',
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const authToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('dialix_token') || localStorage.getItem('token')) : '');
      const query = new URLSearchParams({
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/contacts/export?${query.toString()}`, {
        headers: {
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        }
      });
      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addToast('Contacts exported to CSV', 'success');
    } catch (err) {
      console.error('Export failed', err);
      addToast('Failed to export contacts', 'error');
    } finally {
      setExporting(false);
    }
  };

  const parseCsvLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const normalizeHeader = (header: string): string => {
    const h = header.toLowerCase().replace(/[\s_-]+/g, '');
    if (h === 'firstname' || h === 'first' || h === 'givenname') return 'first_name';
    if (h === 'lastname' || h === 'last' || h === 'surname') return 'last_name';
    if (h === 'phone' || h === 'phonenumber' || h === 'telephone' || h === 'mobile' || h === 'cell') return 'phone';
    if (h === 'email' || h === 'emailaddress') return 'email';
    if (h === 'company' || h === 'organization' || h === 'org' || h === 'business') return 'company';
    if (h === 'status') return 'status';
    return header.trim();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rawLines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (rawLines.length < 2) {
          addToast('Invalid CSV format: requires header and at least one data row', 'error');
          setImporting(false);
          return;
        }

        const rawHeaders = parseCsvLine(rawLines[0]);
        const headers = rawHeaders.map(h => normalizeHeader(h));
        const rows = [];

        for (let i = 1; i < rawLines.length; i++) {
          const values = parseCsvLine(rawLines[i]);
          const row: any = {};
          headers.forEach((h, index) => {
            if (values[index] !== undefined) {
              row[h] = values[index];
            }
          });
          if (row.first_name || row.phone) {
            rows.push(row);
          }
        }

        if (rows.length === 0) {
          addToast('No valid contact records found in CSV file', 'error');
          setImporting(false);
          return;
        }

        const res = await api('/contacts/import', { method: 'POST', body: { rows }, token });
        addToast(`Imported: ${res.imported || 0}, Updated: ${res.updated || 0}, Skipped: ${res.skipped || 0}`, 'success');
        fetchContacts();
        setIsImportModalOpen(false);
      } catch (err: any) {
        console.error('Import failed', err);
        addToast(err?.message || 'Failed to import contacts', 'error');
      } finally {
        setImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const isAllCurrentPageSelected = contacts.length > 0 && contacts.every(c => selectedIds.has(c.id));

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSet = new Set(selectedIds);
    if (e.target.checked) {
      contacts.forEach(c => newSet.add(c.id));
    } else {
      contacts.forEach(c => newSet.delete(c.id));
    }
    setSelectedIds(newSet);
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'lead', label: 'Lead' },
    { value: 'customer', label: 'Customer' },
    { value: 'inactive', label: 'Inactive' },
  ];

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="dashboard-content">
      <div className="page-title-section mb-6">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">Manage your leads, customers, and outreach targets</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button 
            className="btn-secondary flex items-center gap-2" 
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button 
            className="btn-secondary flex items-center gap-2" 
            onClick={() => setIsImportModalOpen(true)}
          >
            <Upload size={16} /> Import CSV
          </button>
          <button 
            className="btn-primary flex items-center gap-2" 
            onClick={openNewModal}
          >
            <Plus size={16} /> Add Contact
          </button>
        </div>
      </div>

      <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0d0f12]/60 backdrop-blur-md p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              className="form-input w-full bg-input"
              style={{ paddingLeft: '38px' }}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto items-center justify-between md:justify-end">
            {selectedIds.size > 0 && (
              <button 
                className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors border border-red-500/30"
                onClick={() => setShowBulkDeleteModal(true)}
              >
                <Trash2 size={14} /> Delete Selected ({selectedIds.size})
              </button>
            )}
            <div className="w-44">
              <CustomSelect
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                options={statusOptions}
                small
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0d0f12]/60 backdrop-blur-md">
        <div className="table-responsive">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/[0.02] border-b border-white/[0.08]">
              <tr className="h-11">
                <th className="py-3.5 px-4 w-[48px]">
                  <input 
                    type="checkbox" 
                    checked={isAllCurrentPageSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-600 bg-transparent cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4 text-xs font-semibold tracking-wider uppercase text-secondary">Name</th>
                <th className="py-3.5 px-4 text-xs font-semibold tracking-wider uppercase text-secondary">Phone & Email</th>
                <th className="py-3.5 px-4 text-xs font-semibold tracking-wider uppercase text-secondary">Company</th>
                <th className="py-3.5 px-4 text-xs font-semibold tracking-wider uppercase text-secondary">Status</th>
                <th className="py-3.5 px-4 text-xs font-semibold tracking-wider uppercase text-secondary text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center text-secondary">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-accent" />
                      <span>Loading contacts...</span>
                    </div>
                  </td>
                </tr>
              ) : !Array.isArray(contacts) || contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4">
                    <EmptyState
                      icon="users"
                      title={search || statusFilter ? "No contacts match search" : "No contacts yet"}
                      description={search || statusFilter ? "No contacts match your current search or status filter." : "Start building your contact lists by adding contacts manually or importing a CSV file."}
                      action={search || statusFilter ? undefined : "Add Contact"}
                      onAction={openNewModal}
                    />
                  </td>
                </tr>
              ) : (
                Array.isArray(contacts) && contacts.map((contact) => (
                  <tr key={contact.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors duration-150 group">
                    <td className="py-3.5 px-4">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(contact.id)}
                        onChange={() => toggleSelect(contact.id)}
                        className="rounded border-gray-600 bg-transparent cursor-pointer"
                      />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white flex items-center gap-2">
                        {contact.first_name} {contact.last_name || ''}
                        {contact.do_not_call === 1 && (
                          <span className="bg-red-500/15 text-red-400 border border-red-500/20 text-[10px] px-2 py-0.5 rounded-full font-medium" title="Do Not Call">DNC</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-sm text-gray-300">
                      <div className="font-mono text-xs text-gray-200">{contact.phone}</div>
                      {contact.email && <div className="text-xs text-gray-500 mt-0.5">{contact.email}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-sm text-gray-400">{contact.company || '—'}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 bg-white/[0.06] text-gray-300 border border-white/10 rounded-full text-xs capitalize font-medium">
                        {contact.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => toggleDnc(contact)}
                          className={`p-1.5 rounded-md hover:bg-white/10 transition-colors ${contact.do_not_call ? 'text-red-400' : 'text-gray-400 hover:text-gray-200'}`}
                          title={contact.do_not_call ? "Remove from Do Not Call" : "Mark as Do Not Call"}
                        >
                          {contact.do_not_call ? <PhoneOff size={15} /> : <Phone size={15} />}
                        </button>
                        <button 
                          onClick={() => openEditModal(contact)}
                          className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          title="Edit Contact"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={() => setDeleteTarget(contact)}
                          className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete Contact"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/[0.08] flex justify-between items-center bg-white/[0.01] text-xs text-secondary">
            <div>
              Showing <span className="text-white font-medium">{(page - 1) * limit + 1}</span> to <span className="text-white font-medium">{Math.min(page * limit, total)}</span> of <span className="text-white font-medium">{total}</span> contacts
            </div>
            <div className="flex items-center gap-2">
              <button 
                className="btn-secondary py-1 px-3 text-xs"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="px-2 text-gray-500">Page {page} of {totalPages}</span>
              <button 
                className="btn-secondary py-1 px-3 text-xs"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header flex justify-between items-center">
              <h2 className="text-base font-semibold text-white">{editingContact ? 'Edit Contact' : 'Add New Contact'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form id="contact-form" onSubmit={handleSaveContact}>
              <div className="modal-body space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label text-xs text-gray-400 mb-1 block">First Name *</label>
                    <input 
                      type="text" 
                      required
                      className="form-input w-full bg-input"
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                      placeholder="e.g. Sarah"
                    />
                  </div>
                  <div>
                    <label className="form-label text-xs text-gray-400 mb-1 block">Last Name</label>
                    <input 
                      type="text" 
                      className="form-input w-full bg-input"
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                      placeholder="e.g. Connor"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label text-xs text-gray-400 mb-1 block">Phone Number (E.164) *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="+1234567890"
                    className="form-input w-full bg-input font-mono text-sm"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Include country code with plus prefix (e.g. +1 for US/Canada)</p>
                </div>

                <div>
                  <label className="form-label text-xs text-gray-400 mb-1 block">Email</label>
                  <input 
                    type="email" 
                    className="form-input w-full bg-input"
                    value={formData.email}
                    placeholder="sarah@example.com"
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                <div>
                  <label className="form-label text-xs text-gray-400 mb-1 block">Company</label>
                  <input 
                    type="text" 
                    className="form-input w-full bg-input"
                    value={formData.company}
                    placeholder="Acme Inc."
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                  />
                </div>

                <div>
                  <label className="form-label text-xs text-gray-400 mb-1 block">Status</label>
                  <CustomSelect
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'lead', label: 'Lead' },
                      { value: 'customer', label: 'Customer' },
                      { value: 'inactive', label: 'Inactive' },
                    ]}
                  />
                </div>
              </div>
              
              <div className="modal-footer flex justify-end gap-3 mt-4">
                <button type="button" className="btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  {saving ? 'Saving...' : editingContact ? 'Save Changes' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="modal-overlay" onClick={() => !importing && setIsImportModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header flex justify-between items-center">
              <h2 className="text-base font-semibold text-white">Import Contacts from CSV</h2>
              <button 
                onClick={() => !importing && setIsImportModalOpen(false)} 
                className="text-gray-400 hover:text-white transition-colors"
                disabled={importing}
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="modal-body p-6">
              <div className="border border-dashed border-white/20 rounded-xl p-8 text-center bg-base/50 hover:bg-white/[0.02] transition-colors relative cursor-pointer">
                <input 
                  type="file" 
                  accept=".csv"
                  disabled={importing}
                  onChange={handleImport}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {importing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="mx-auto mb-3 text-accent animate-spin" size={32} />
                    <p className="text-white font-medium text-sm">Processing and uploading contacts...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto mb-3 text-gray-400" size={30} />
                    <p className="text-white font-medium text-sm mb-1">Click to browse or drop CSV file here</p>
                    <p className="text-xs text-gray-500">Requires header with first_name and phone</p>
                  </>
                )}
              </div>
              
              <div className="mt-5 text-xs text-gray-400">
                <p className="font-medium text-gray-300 mb-2">Supported CSV columns:</p>
                <div className="bg-base p-3 rounded-lg border border-default font-mono text-[11px] text-gray-400 leading-relaxed">
                  first_name,last_name,phone,email,company<br/>
                  Sarah,Connor,+14155552671,sarah@example.com,Cyberdyne<br/>
                  John,Doe,+12125550199,john@example.com,Acme
                </div>
              </div>
            </div>

            <div className="modal-footer flex justify-end">
              <button 
                type="button" 
                className="btn-ghost" 
                onClick={() => setIsImportModalOpen(false)}
                disabled={importing}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Contact Confirm */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Contact"
          message={`Are you sure you want to delete "${deleteTarget.first_name}${deleteTarget.last_name ? ' ' + deleteTarget.last_name : ''}" (${deleteTarget.phone})? This action cannot be undone.`}
          confirmLabel="Delete Contact"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          danger={true}
        />
      )}

      {/* Bulk Delete Confirm */}
      {showBulkDeleteModal && (
        <ConfirmModal
          title="Delete Selected Contacts"
          message={`Are you sure you want to permanently delete ${selectedIds.size} selected contact${selectedIds.size === 1 ? '' : 's'}?`}
          confirmLabel={`Delete (${selectedIds.size})`}
          onConfirm={confirmBulkDelete}
          onCancel={() => setShowBulkDeleteModal(false)}
          danger={true}
        />
      )}
    </div>
  );
}

