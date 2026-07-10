import React, { useState, useEffect } from 'react';

export default function App() {
  const API_BASE = "/api";
  
  // App Core State Layers
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [stagedData, setStagedData] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | import | audit
  const [selectedAuditUser, setSelectedAuditUser] = useState("Aisha");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Auto-fetch groups on layout load
  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchFinancialAnalytics();
    }
  }, [selectedGroupId]);

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_BASE}/groups`);
      const data = await res.json();
      setGroups(data);
      if (data.length > 0) setSelectedGroupId(data[0].id);
    } catch (e) {
      console.error("Failed to connect to backend", e);
    }
  };

  const initializeDefaultGroup = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: "Flat 404 Shared Spaces Group" })
      });
      const newGroup = await res.json();
      setMessage("Standard Group Initialized successfully with active timeline bounds!");
      fetchGroups();
      setSelectedGroupId(newGroup.id);
    } catch (err) {
      setMessage("Failed to construct default operational group bounds.");
    }
    setLoading(false);
  };

  const handleCsvFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/importer/stage`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error("Parser handling error caught.");
      const data = await res.json();
      setStagedData(data);
      setMessage(`CSV Ingestion Completed! Caught ${data.summary_report.length} active data anomalies.`);
    } catch (err) {
      setMessage("CSV Processing Engine failed to complete staging checks safely.");
    }
    setLoading(false);
  };

  const handleUpdateStagedField = (index, field, value) => {
    const updated = { ...stagedData };
    updated.records[index][field] = value;
    setStagedData(updated);
  };

  const commitApprovedDataToDb = async () => {
    if (!selectedGroupId || !stagedData) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/importer/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: selectedGroupId,
          approved_records: stagedData.records
        })
      });
      const result = await res.json();
      setMessage(result.message);
      setStagedData(null);
      fetchFinancialAnalytics();
      setActiveTab('dashboard');
    } catch (err) {
      setMessage("Transactional commit failed to apply updates safely.");
    }
    setLoading(false);
  };

  const fetchFinancialAnalytics = async () => {
    if (!selectedGroupId) return;
    try {
      const res = await fetch(`${API_BASE}/groups/${selectedGroupId}/balances`);
      const data = await res.json();
      setFinancials(data);
    } catch (err) {
      console.error("Failed to load ledgers.", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Navigation Topbar Bar Header */}
      <header className="bg-indigo-900 text-white shadow-md px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <span className="text-xl font-black tracking-wider">⚡ CO-SPLIT</span>
          <span className="bg-indigo-700 text-xs px-2.5 py-1 rounded-full font-bold">Relational Engine V1</span>
        </div>
        <div className="flex items-center space-x-4">
          {groups.length === 0 ? (
            <button onClick={initializeDefaultGroup} className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded text-sm font-bold transition">
              Initialize Flat Group
            </button>
          ) : (
            <select 
              value={selectedGroupId || ""} 
              onChange={(e) => setSelectedGroupId(Number(e.target.value))}
              className="bg-indigo-800 text-white border-none rounded px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </div>
      </header>

      {/* Global Status Message Bar */}
      {message && (
        <div className="bg-indigo-50 border-b border-indigo-200 text-indigo-900 font-medium px-6 py-2.5 text-sm flex justify-between items-center">
          <span>🔔 {message}</span>
          <button onClick={() => setMessage("")} className="text-indigo-400 hover:text-indigo-900 font-bold">×</button>
        </div>
      )}

      {/* Dashboard Submenu Tab Rails */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="border-b border-slate-200 flex space-x-6">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`pb-3 text-sm font-bold tracking-wide transition-all ${activeTab === 'dashboard' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}
          >
            📊 AISHA'S NET CLEARING LEDGER
          </button>
          <button 
            onClick={() => setActiveTab('audit')} 
            className={`pb-3 text-sm font-bold tracking-wide transition-all ${activeTab === 'audit' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}
          >
            🔍 ROHAN'S ITEMIZED AUDIT TRAILS
          </button>
          <button 
            onClick={() => setActiveTab('import')} 
            className={`pb-3 text-sm font-bold tracking-wide transition-all ${activeTab === 'import' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}
          >
            📥 MEERA'S CONTROL DATA IMPORT ENGINE
          </button>
        </div>

        {/* --- MAIN INTERACTIVE VIEW CONTROLLERS --- */}
        <main className="py-6">
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-slate-500 text-xs mt-2 font-semibold">COMPUTING RELATIONAL TRANSACTIONS...</p>
            </div>
          )}

          {/* TAB 1: AISHA'S SIMPLIFIED VIEW */}
          {!loading && activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card A: Raw Account Balances */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-xs font-black text-slate-400 tracking-wider mb-4">RAW SYSTEM BALANCES (INR)</h3>
                {financials?.raw_net_balances && Object.keys(financials.raw_net_balances).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(financials.raw_net_balances).map(([name, b]) => (
                      <div key={name} className="flex justify-between items-center py-2 border-b border-slate-50">
                        <span className="font-bold text-slate-700">{name}</span>
                        <span className={`text-sm font-extrabold ${b >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {b >= 0 ? `+₹${b.toLocaleString()}` : `-₹${Math.abs(b).toLocaleString()}`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 font-medium">No ledger balances computed yet. Complete a data import pass.</p>
                )}
              </div>

              {/* Card B: Aisha's Optimized Net Settlements Request */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 md:col-span-2">
                <h3 className="text-xs font-black text-slate-400 tracking-wider mb-4">AISHA'S NET DEBT SETTLEMENT CLEARING LIST</h3>
                {financials?.aisha_simplified_settlements && financials.aisha_simplified_settlements.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {financials.aisha_simplified_settlements.map((tx, idx) => (
                      <div key={idx} className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100 flex flex-col justify-between">
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Transaction Pair #{idx + 1}</div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-rose-600 font-extrabold">{tx.from}</span>
                          <span className="text-slate-400 font-medium text-xs">owes</span>
                          <span className="text-emerald-600 font-extrabold">{tx.to}</span>
                        </div>
                        <div className="text-right text-lg font-black text-slate-800 mt-2">
                          ₹{tx.amount.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed text-slate-400 text-sm font-medium">
                    Ledger system is perfectly balanced to zero. No payments are outstanding!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ROHAN'S ITEMIZED AUDIT VIEW */}
          {!loading && activeTab === 'audit' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 mb-4 space-y-3 sm:space-y-0">
                <div>
                  <h3 className="text-sm font-black text-slate-700 tracking-wide">ROHAN'S TRANSACTION AUDIT ENGINE</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Line-by-line tracing for full financial transparency.</p>
                </div>
                <div className="flex space-x-2">
                  {["Aisha", "Rohan", "Priya", "Meera", "Sam", "Dev"].map(u => (
                    <button 
                      key={u} 
                      onClick={() => setSelectedAuditUser(u)}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${selectedAuditUser === u ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {financials?.rohan_itemized_audit_trail && financials.rohan_itemized_audit_trail[selectedAuditUser]?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b">
                        <th className="py-3 px-4">Effective Date</th>
                        <th className="py-3 px-4">Line Description</th>
                        <th className="py-3 px-4">Allocation Mapping</th>
                        <th className="py-3 px-4 text-right">Impact Balance (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {financials.rohan_itemized_audit_trail[selectedAuditUser].map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-all">
                          <td className="py-3 px-4 font-mono text-xs text-slate-500">{item.date}</td>
                          <td className="py-3 px-4 font-semibold text-slate-700">{item.description}</td>
                          <td className="py-3 px-4 text-xs font-medium text-slate-400 italic">{item.context}</td>
                          <td className={`py-3 px-4 font-extrabold text-right ${item.type === 'CREDIT_DUE' ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {item.type === 'CREDIT_DUE' ? `+₹${item.amount.toFixed(2)}` : `-₹${item.amount.toFixed(2)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-sm font-medium">
                  No line-item allocation history found for {selectedAuditUser} in this target database ledger.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MEERA'S INTERACTIVE IMPORTER STAGING ENGINE */}
          {!loading && activeTab === 'import' && (
            <div className="space-y-6">
              {/* File Uploader Control Deck */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 text-center">
                <h3 className="text-sm font-black text-slate-700 tracking-wide mb-2">RAW SOURCE REPOSITORY INGESTION HARNESS</h3>
                <p className="text-xs text-slate-400 max-w-xl mx-auto mb-4">
                  Upload the original, unedited <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">expenses_export.csv</code> data file. 
                  The pipeline will intercept data anomalies before finalizing database writes.
                </p>
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleCsvFileUpload} 
                  className="mx-auto block text-xs file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>

              {/* Dynamic Staging Report Table Matrix */}
              {stagedData && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="bg-slate-900 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-white space-y-3 sm:space-y-0">
                    <div>
                      <h4 className="text-sm font-black tracking-wide text-indigo-400">MEERA'S PIPELINE STAGING SCREEN</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Review, override, and explicitly authorize row inputs.</p>
                    </div>
                    <button onClick={commitApprovedDataToDb} className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 px-5 py-2 rounded text-xs font-black tracking-wide transition-all uppercase shadow-md">
                      Authorize Updates & Write to DB
                    </button>
                  </div>

                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-100 shadow-sm border-b z-10 text-slate-500 font-bold uppercase">
                        <tr>
                          <th className="py-3 px-4 w-12 text-center">Row</th>
                          <th className="py-3 px-4 w-32">Effective Date</th>
                          <th className="py-3 px-4 w-48">Description</th>
                          <th className="py-3 px-4 w-28">Payer Account</th>
                          <th className="py-3 px-4 w-28">Base Amt</th>
                          <th className="py-3 px-4 w-24">Curr</th>
                          <th className="py-3 px-4 w-32">Unified (INR)</th>
                          <th className="py-3 px-4">Anomalies Surfaced / Flags</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stagedData.records.map((rec, idx) => {
                          const hasCritical = rec.anomalies.some(a => a.severity === 'CRITICAL');
                          const hasHigh = rec.anomalies.some(a => a.severity === 'HIGH');
                          const rowColor = hasCritical ? 'bg-rose-50/60' : hasHigh ? 'bg-amber-50/40' : 'hover:bg-slate-50/50';

                          return (
                            <tr key={idx} className={`${rowColor} transition-all`}>
                              <td className="py-3 px-4 text-center font-mono text-slate-400 font-bold">{rec.id + 1}</td>
                              <td className="py-2 px-2">
                                <input 
                                  type="text" 
                                  value={rec.date} 
                                  onChange={(e) => handleUpdateStagedField(idx, 'date', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                              </td>
                              <td className="py-2 px-2 font-medium text-slate-700">{rec.description}</td>
                              <td className="py-2 px-2">
                                <input 
                                  type="text" 
                                  value={rec.paid_by || ""} 
                                  placeholder="MISSING"
                                  onChange={(e) => handleUpdateStagedField(idx, 'paid_by', e.target.value)}
                                  className={`w-full border rounded px-2 py-1 text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none ${!rec.paid_by ? 'border-rose-300 bg-rose-50 text-rose-600 placeholder-rose-400' : 'border-slate-200 bg-white text-slate-700'}`}
                                />
                              </td>
                              <td className="py-3 px-4 font-mono font-semibold text-slate-600">{rec.amount}</td>
                              <td className="py-3 px-4 font-bold text-slate-500">{rec.currency}</td>
                              <td className="py-2 px-2">
                                <input 
                                  type="number" 
                                  value={rec.amount_in_inr} 
                                  onChange={(e) => handleUpdateStagedField(idx, 'amount_in_inr', Number(e.target.value))}
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 font-mono font-bold text-slate-700 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                              </td>
                              <td className="py-3 px-4">
                                {rec.anomalies.length > 0 ? (
                                  <div className="space-y-1">
                                    {rec.anomalies.map((anom, aIdx) => (
                                      <span 
                                        key={aIdx} 
                                        className={`inline-block mr-1.5 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide shadow-sm ${anom.severity === 'CRITICAL' ? 'bg-rose-600 text-white animate-pulse' : anom.severity === 'HIGH' ? 'bg-amber-500 text-white' : 'bg-indigo-100 text-indigo-800'}`}
                                        title={anom.message}
                                      >
                                        ⚠️ [{anom.type}] {anom.message}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-emerald-600 font-bold font-mono text-[10px] uppercase tracking-wider">✓ Record Valid</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}