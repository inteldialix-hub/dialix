'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Search, Plus, Upload, Download, Trash2, Edit2, MoreVertical, X, PhoneOff, Phone } from 'lucide-react';
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
  const { user } = useAuth();
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
    fetchContacts();
  }, [page, search, statusFilter]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });
      
      const res = await api.get(`/api/contacts?${query.toString()}`);
      if (res.data) {
        setContacts(res.data.contacts);
        setTotal(res.data.total);
      }
    } catch (err) {
      console.error('Failed to load contacts', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingContact) {
        await api.put(`/api/contacts/${editingContact.id}`, formData);
      } else {
        await api.post('/api/contacts', formData);
      }
      setIsModalOpen(false);
      fetchContacts();
    } catch (err) {
      console.error('Failed to save contact', err);
      alert('Failed to save contact. Check phone format.');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      try {
        await api.delete(`/api/contacts/${id}`);
        fetchContacts();
      } catch (err) {
        console.error('Delete failed', err);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Delete ${selectedIds.size} contacts?`)) {
      try {
        await api.post('/api/contacts/bulk-delete', { ids: Array.from(selectedIds) });
        setSelectedIds(new Set());
        fetchContacts();
      } catch (err) {
        console.error('Bulk delete failed', err);
      }
    }
  };

  const toggleDnc = async (contact: Contact) => {
    try {
      if (contact.do_not_call) {
        await api.delete(`/api/contacts/${contact.id}/dnc`);
      } else {
        await api.post(`/api/contacts/${contact.id}/dnc`, { reason: 'Manual toggle' });
      }
      fetchContacts();
    } catch (err) {
      console.error('Failed to toggle DNC', err);
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
    try {
      const query = new URLSearchParams({
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/contacts/export?${query.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        if (lines.length < 2) return alert('Invalid CSV');
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows = [];
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const row: any = {};
          headers.forEach((h, index) => {
            row[h] = values[index];
          });
          rows.push(row);
        }

        const res = await api.post('/api/contacts/import', { rows });
        alert(`Imported: ${res.data.imported}, Updated: ${res.data.updated}, Skipped: ${res.data.skipped}, Invalid: ${res.data.invalid}`);
        fetchContacts();
        setIsImportModalOpen(false);
      } catch (err) {
        console.error('Import failed', err);
        alert('Failed to import contacts');
      }
    };
    reader.readAsText(file);
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(contacts.map(c => c.id)));
    } else {
      setSelectedIds(new Set());
    }
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

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="dashboard-content">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Contacts</h1>
          <p className="text-gray-400">Manage your leads and customers</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary flex items-center gap-2" onClick={handleExport}>
            <Download size={16} /> Export
          </button>
          <button className="btn-secondary flex items-center gap-2" onClick={() => setIsImportModalOpen(true)}>
            <Upload size={16} /> Import
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={openNewModal}>
            <Plus size={16} /> Add Contact
          </button>
        </div>
      </div>

      <div className="bg-raised rounded-lg border border-default p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search contacts..."
              className="form-input pl-10 w-full bg-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto items-center">
            {selectedIds.size > 0 && (
              <button 
                className="bg-red-500/20 text-red-500 hover:bg-red-500/30 px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors"
                onClick={handleBulkDelete}
              >
                <Trash2 size={16} /> Delete Selected ({selectedIds.size})
              </button>
            )}
            <select
              className="form-input bg-input min-w-[150px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="lead">Lead</option>
              <option value="customer">Customer</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-raised border border-default rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-base border-b border-default text-gray-400 text-sm">
              <tr>
                <th className="p-4 w-[50px]">
                  <input 
                    type="checkbox" 
                    checked={contacts.length > 0 && selectedIds.size === contacts.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-600 bg-transparent"
                  />
                </th>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Contact</th>
                <th className="p-4 font-medium">Company</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">Loading contacts...</td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    No contacts found. Try adjusting filters or adding a new contact.
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(contact.id)}
                        onChange={() => toggleSelect(contact.id)}
                        className="rounded border-gray-600 bg-transparent"
                      />
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-white flex items-center gap-2">
                        {contact.first_name} {contact.last_name}
                        {contact.do_not_call === 1 && (
                          <span className="bg-red-500/20 text-red-500 text-xs px-2 py-0.5 rounded-full" title="Do Not Call">DNC</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-300">
                      <div>{contact.phone}</div>
                      {contact.email && <div className="text-gray-500">{contact.email}</div>}
                    </td>
                    <td className="p-4 text-sm text-gray-300">{contact.company || '-'}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-white/10 text-gray-300 rounded text-xs capitalize">
                        {contact.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => toggleDnc(contact)}
                          className={`p-1.5 rounded hover:bg-white/10 ${contact.do_not_call ? 'text-red-400' : 'text-gray-400'}`}
                          title={contact.do_not_call ? "Remove from DNC" : "Mark as DNC"}
                        >
                          {contact.do_not_call ? <PhoneOff size={16} /> : <Phone size={16} />}
                        </button>
                        <button 
                          onClick={() => openEditModal(contact)}
                          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(contact.id)}
                          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-red-400"
                          title="Delete"
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
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-default flex justify-between items-center bg-base text-sm">
            <div className="text-gray-400">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
            </div>
            <div className="flex gap-2">
              <button 
                className="btn-secondary py-1 px-3"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button 
                className="btn-secondary py-1 px-3"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-raised border border-default rounded-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-default flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-white">{editingContact ? 'Edit Contact' : 'Add New Contact'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              <form id="contact-form" onSubmit={handleSaveContact} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label text-sm text-gray-400 mb-1 block">First Name *</label>
                    <input 
                      type="text" 
                      required
                      className="form-input w-full bg-input"
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="form-label text-sm text-gray-400 mb-1 block">Last Name</label>
                    <input 
                      type="text" 
                      className="form-input w-full bg-input"
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label text-sm text-gray-400 mb-1 block">Phone Number *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="+1234567890"
                    className="form-input w-full bg-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                  <p className="text-xs text-gray-500 mt-1">Include country code (e.g. +1 for US)</p>
                </div>

                <div>
                  <label className="form-label text-sm text-gray-400 mb-1 block">Email</label>
                  <input 
                    type="email" 
                    className="form-input w-full bg-input"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                <div>
                  <label className="form-label text-sm text-gray-400 mb-1 block">Company</label>
                  <input 
                    type="text" 
                    className="form-input w-full bg-input"
                    value={formData.company}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                  />
                </div>

                <div>
                  <label className="form-label text-sm text-gray-400 mb-1 block">Status</label>
                  <select 
                    className="form-input w-full bg-input"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="active">Active</option>
                    <option value="lead">Lead</option>
                    <option value="customer">Customer</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </form>
            </div>
            
            <div className="p-4 border-t border-default flex justify-end gap-3 shrink-0">
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button type="submit" form="contact-form" className="btn-primary">
                {editingContact ? 'Save Changes' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-raised border border-default rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-default flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Import Contacts</h2>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center bg-base hover:bg-white/5 transition-colors relative">
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleImport}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="mx-auto mb-3 text-gray-400" size={32} />
                <p className="text-white font-medium mb-1">Click or drag CSV to upload</p>
                <p className="text-sm text-gray-500">Requires first_name and phone columns</p>
              </div>
              
              <div className="mt-6 text-sm text-gray-400">
                <p className="font-medium text-gray-300 mb-2">Example CSV format:</p>
                <div className="bg-base p-3 rounded font-mono text-xs">
                  first_name,last_name,phone,email<br/>
                  John,Doe,+1234567890,john@example.com<br/>
                  Jane,Smith,+0987654321,jane@example.com
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
