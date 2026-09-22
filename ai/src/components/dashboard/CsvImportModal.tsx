import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/dashboard/shared/ToastProvider';

interface CsvImportModalProps {
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'upload' | 'mapping' | 'importing' | 'results';

interface Mapping {
  [csvColumn: string]: string; // Maps csv column to contact field
}

export function CsvImportModal({ token, isOpen, onClose, onSuccess }: CsvImportModalProps) {
  const { addToast } = useToast();
  const [step, setStep] = useState<Step>('upload');
  
  // File data
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [rawLines, setRawLines] = useState<string[]>([]);
  
  // Mapping state
  const [mapping, setMapping] = useState<Mapping>({});
  
  // Results
  const [results, setResults] = useState<{ imported: number; updated: number; skipped: number; invalid: number }>({ imported: 0, updated: 0, skipped: 0, invalid: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const contactFields = [
    { value: '', label: 'Ignore this column' },
    { value: 'first_name', label: 'First Name *' },
    { value: 'last_name', label: 'Last Name' },
    { value: 'phone', label: 'Phone Number *' },
    { value: 'email', label: 'Email Address' },
    { value: 'company', label: 'Company' },
    { value: 'country', label: 'Country' },
    { value: 'language', label: 'Language' }
  ];

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
    if (h === 'country') return 'country';
    if (h === 'language') return 'language';
    return '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        
        if (lines.length < 2) {
          addToast('Invalid CSV format: requires header and at least one data row', 'error');
          return;
        }

        const rawHeaders = parseCsvLine(lines[0]);
        setHeaders(rawHeaders);
        
        // Auto map based on normalized headers
        const initialMapping: Mapping = {};
        rawHeaders.forEach(h => {
          const norm = normalizeHeader(h);
          if (norm) initialMapping[h] = norm;
        });
        setMapping(initialMapping);

        // Preview first 5 rows
        const preview = lines.slice(1, 6).map(l => parseCsvLine(l));
        setPreviewRows(preview);
        setRawLines(lines);
        setStep('mapping');
      } catch (err) {
        addToast('Failed to parse CSV file', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    // Check if phone and first_name are mapped
    const mappedValues = Object.values(mapping);
    if (!mappedValues.includes('phone') || !mappedValues.includes('first_name')) {
      addToast('You must map both First Name and Phone Number', 'error');
      return;
    }

    setStep('importing');

    try {
      const rows = [];
      let invalidCount = 0;

      for (let i = 1; i < rawLines.length; i++) {
        const values = parseCsvLine(rawLines[i]);
        const row: any = {};
        let hasData = false;

        headers.forEach((h, index) => {
          const field = mapping[h];
          if (field && values[index] !== undefined && values[index].trim() !== '') {
            row[field] = values[index];
            hasData = true;
          }
        });

        // Basic validation
        if (hasData) {
          if (!row.first_name || !row.phone) {
            invalidCount++;
          } else {
            rows.push(row);
          }
        }
      }

      if (rows.length === 0) {
        addToast('No valid contact records found', 'error');
        setStep('mapping');
        return;
      }

      const res = await api('/contacts/import', { method: 'POST', body: { rows }, token });
      setResults({
        imported: res.imported || 0,
        updated: res.updated || 0,
        skipped: res.skipped || 0,
        invalid: invalidCount
      });
      setStep('results');
      onSuccess();
    } catch (err: any) {
      addToast(err?.message || 'Failed to import contacts', 'error');
      setStep('mapping');
    }
  };

  const handleReset = () => {
    setStep('upload');
    setHeaders([]);
    setPreviewRows([]);
    setRawLines([]);
    setMapping({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => step !== 'importing' && onClose()}>
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-lg flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-border">
          <h2 className="text-lg font-medium">Import Contacts</h2>
          <button 
            onClick={() => step !== 'importing' && onClose()} 
            className="text-muted-foreground hover:text-foreground transition-colors"
            disabled={step === 'importing'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {step === 'upload' && (
            <div className="mb-2">
              <div 
                className="border-2 border-dashed border-border rounded-lg p-12 text-center bg-muted/20 hover:bg-muted/40 transition-colors relative cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Upload className="mx-auto mb-4 text-muted-foreground" size={40} />
                <h3 className="font-medium text-base mb-1">Click to browse for CSV file</h3>
                <p className="text-sm text-muted-foreground">Upload your exported contacts as a .csv file</p>
              </div>
              
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3">Requirements:</h4>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                  <li>First row must contain column headers</li>
                  <li>At least First Name and Phone Number are required for each contact</li>
                  <li>Phone numbers should ideally include country code (e.g. +1)</li>
                  <li>Maximum 5,000 contacts per import</li>
                </ul>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="flex flex-col gap-6">
              <div className="bg-emerald-500/10 text-emerald-500 p-3 rounded-md text-sm flex items-start gap-3 border border-emerald-500/20">
                <CheckCircle size={18} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">File parsed successfully ({rawLines.length - 1} rows found)</p>
                  <p className="text-emerald-500/80 mt-0.5">Please map your CSV columns to the appropriate contact fields.</p>
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium text-foreground w-1/3">CSV Column Header</th>
                      <th className="px-4 py-3 font-medium text-foreground w-1/3">Map to Field</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground w-1/3">Preview (First Row)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {headers.map((header, idx) => (
                      <tr key={idx} className="bg-card">
                        <td className="px-4 py-3 font-medium">{header}</td>
                        <td className="px-4 py-3">
                          <select 
                            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            value={mapping[header] || ''}
                            onChange={(e) => setMapping({ ...mapping, [header]: e.target.value })}
                          >
                            {contactFields.map(field => (
                              <option key={field.value} value={field.value}>{field.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground truncate max-w-[150px]" title={previewRows[0]?.[idx] || ''}>
                          {previewRows[0]?.[idx] || <span className="italic opacity-50">Empty</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {!Object.values(mapping).includes('phone') || !Object.values(mapping).includes('first_name') ? (
                <div className="text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>You must map columns to both <strong>First Name</strong> and <strong>Phone Number</strong>.</span>
                </div>
              ) : null}
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary mb-4" size={48} />
              <h3 className="text-lg font-medium mb-2">Importing Contacts...</h3>
              <p className="text-muted-foreground text-sm">This may take a minute depending on the file size.</p>
            </div>
          )}

          {step === 'results' && (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-xl font-medium mb-6">Import Complete</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-lg mb-8">
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-3xl font-semibold text-foreground mb-1">{results.imported}</p>
                  <p className="text-xs text-muted-foreground uppercase font-medium">New</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-3xl font-semibold text-blue-500 mb-1">{results.updated}</p>
                  <p className="text-xs text-muted-foreground uppercase font-medium">Updated</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-3xl font-semibold text-yellow-500 mb-1">{results.skipped}</p>
                  <p className="text-xs text-muted-foreground uppercase font-medium">Skipped</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-3xl font-semibold text-red-500 mb-1">{results.invalid}</p>
                  <p className="text-xs text-muted-foreground uppercase font-medium">Invalid</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-between items-center bg-muted/30">
          {step === 'mapping' ? (
            <button 
              type="button" 
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground text-sm px-3 py-2 transition-colors"
            >
              Choose different file
            </button>
          ) : (
            <div></div> // Spacer
          )}

          <div className="flex gap-3">
            {step !== 'importing' && step !== 'results' && (
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-foreground bg-transparent border border-border rounded-md hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            )}

            {step === 'mapping' && (
              <button 
                type="button" 
                onClick={handleImport}
                disabled={!Object.values(mapping).includes('phone') || !Object.values(mapping).includes('first_name')}
                className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import Contacts <ArrowRight size={16} />
              </button>
            )}

            {step === 'results' && (
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
