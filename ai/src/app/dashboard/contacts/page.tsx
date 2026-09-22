/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { Search, Plus, Upload, Download, Trash2, Edit2, X, PhoneOff, Phone, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTopBar } from '@/components/dashboard/TopBarContext';

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
  const { setTopBar } = useTopBar();
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
    { value: '', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'lead', label: 'Lead' },
    { value: 'customer', label: 'Customer' },
    { value: 'inactive', label: 'Inactive' },
  ];

  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    setTopBar({
      title: 'Contacts',
      actions: (
        <div className="flex items-center gap-3 flex-wrap">
          <button 
            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm flex items-center gap-2 border border-border" 
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button 
            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm flex items-center gap-2 border border-border" 
            onClick={() => setIsImportModalOpen(true)}
          >
            <Upload size={16} /> Import CSV
          </button>
          <button 
            className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2" 
            onClick={openNewModal}
          >
            <Plus size={16} /> Add contact
          </button>
        </div>
      )
    });
  }, [setTopBar, exporting]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring pl-9"
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
                className="bg-red-600 text-white hover:bg-red-700 rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2"
                onClick={() => setShowBulkDeleteModal(true)}
              >
                <Trash2 size={16} /> Delete selected ({selectedIds.size})
              </button>
            )}
            <div className="w-44">
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-left divide-y divide-border">
          <thead>
            <tr>
              <th className="px-4 py-3 w-[48px]">
                <input 
                  type="checkbox" 
                  checked={isAllCurrentPageSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-muted-foreground/30 bg-background focus:ring-ring cursor-pointer"
                />
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Name</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Phone & email</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Company</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Status</th>
              <th className="text-right font-medium text-muted-foreground px-4 py-3 text-sm">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 px-4 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm">Loading contacts...</span>
                  </div>
                </td>
              </tr>
            ) : !Array.isArray(contacts) || contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 px-4">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Users className="h-8 w-8 text-muted-foreground mb-3" />
                    <h3 className="text-lg font-medium">{search || statusFilter ? "No contacts match search" : "No contacts yet"}</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">{search || statusFilter ? "No contacts match your current search or status filter." : "Start building your contact lists by adding contacts manually or importing a CSV file."}</p>
                    {!(search || statusFilter) && (
                      <button 
                        className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2"
                        onClick={openNewModal}
                      >
                        <Plus size={16} /> Add contact
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              Array.isArray(contacts) && contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-accent/50 transition-colors group">
                  <td className="px-4 py-3">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(contact.id)}
                      onChange={() => toggleSelect(contact.id)}
                      className="rounded border-muted-foreground/30 bg-background focus:ring-ring cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium flex items-center gap-2">
                      {contact.first_name} {contact.last_name || ''}
                      {contact.do_not_call === 1 && (
                        <span className="bg-red-500/10 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-medium" title="Do Not Call">DNC</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-mono text-xs">{contact.phone}</div>
                    {contact.email && <div className="text-xs text-muted-foreground mt-0.5">{contact.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{contact.company || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground capitalize">
                      {contact.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => toggleDnc(contact)}
                        className={cn("p-1.5 rounded-md hover:bg-accent transition-colors", contact.do_not_call ? 'text-red-400 hover:text-red-500' : 'text-muted-foreground hover:text-foreground')}
                        title={contact.do_not_call ? "Remove from Do Not Call" : "Mark as Do Not Call"}
                      >
                        {contact.do_not_call ? <PhoneOff size={16} /> : <Phone size={16} />}
                      </button>
                      <button 
                        onClick={() => openEditModal(contact)}
                        className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit contact"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => setDeleteTarget(contact)}
                        className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-red-400 transition-colors"
                        title="Delete contact"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex gap-1">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-1 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button 
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-1 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium">{editingContact ? 'Edit contact' : 'Add new contact'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveContact}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">First name *</label>
                    <input 
                      type="text" 
                      required
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                      placeholder="e.g. Sarah"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Last name</label>
                    <input 
                      type="text" 
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                      placeholder="e.g. Connor"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Phone number (E.164) *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="+1234567890"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Include country code with plus prefix (e.g. +1 for US/Canada)</p>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Email</label>
                  <input 
                    type="email" 
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={formData.email}
                    placeholder="sarah@example.com"
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Company</label>
                  <input 
                    type="text" 
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={formData.company}
                    placeholder="Acme Inc."
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Status</label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    {statusOptions.filter(o => o.value !== '').map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2" disabled={saving}>
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving ? 'Saving...' : editingContact ? 'Save changes' : 'Add contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CsvImportModal 
        token={token || ''}
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          setIsImportModalOpen(false);
          fetchContacts();
        }}
      />

      {/* Delete Single Contact Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-medium mb-2">Delete contact</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete "{deleteTarget.first_name}{deleteTarget.last_name ? ' ' + deleteTarget.last_name : ''}" ({deleteTarget.phone})? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteTarget(null)}
                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="bg-red-600 text-white hover:bg-red-700 rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2"
              >
                Delete contact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-medium mb-2">Delete selected contacts</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to permanently delete {selectedIds.size} selected contact{selectedIds.size === 1 ? '' : 's'}?
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowBulkDeleteModal(false)}
                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={confirmBulkDelete}
                className="bg-red-600 text-white hover:bg-red-700 rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2"
              >
                Delete ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
