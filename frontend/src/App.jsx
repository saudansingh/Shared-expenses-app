import React, { useState, useEffect, useCallback } from 'react';
import BASE_URL from './api.js';

export default function App() {
  const API_BASE = BASE_URL;
  
  // App Core State Layers
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [stagedData, setStagedData] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | import | audit
  
  // New UI Sub-State Layer for Splitwise-style Dashboard Isolation
  const [dashboardView, setDashboardView] = useState('balances'); // balances | settlements
  
  const [selectedAuditUser, setSelectedAuditUser] = useState("Aisha");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [initStatus, setInitStatus] = useState("");

  // Memoized fetchGroups to safely structure standard dependency tracking rules
  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/groups`);
      const data = await res.json();
      setGroups(data);
      if (data && data.length > 0) {
        setSelectedGroupId(data[0].id);
      }
    } catch (e) {
      console.error("Failed to connect to backend", e);
    }
  }, [API_BASE]);

  // Memoized analytics collection to structure dependency safety rules
  const fetchFinancialAnalytics = useCallback(async () => {
    if (!selectedGroupId) return;
    try {
      const res = await fetch(`${API_BASE}/groups/${selectedGroupId}/balances`);
      const data = await res.json();
      setFinancials(data);
    } catch (err) {
      console.error("Failed to load ledgers.", err);
    }
  }, [API_BASE, selectedGroupId]);

  // Auto-fetch groups on layout load
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Sync balances and ledger updates automatically upon switching group layers
  useEffect(() => {
    if (selectedGroupId !== null) {
      fetchFinancialAnalytics();
    }
  }, [selectedGroupId, fetchFinancialAnalytics]);

  const handleInitializeGroup = async () => {
    try {
      setInitStatus("loading");
      const response = await fetch(`${BASE_URL}/groups/initialize`, { method: 'POST' });
      const data = await response.json();
      
      if (data.status === "success") {
        setInitStatus("success");
        alert(data.message);
      } else {
        setInitStatus("error");
        alert("Error initializing database layout: " + data.message);
      }
    } catch (err) {
      setInitStatus("error");
      console.error("Initialization call failed:", err);
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
      await fetchGroups();
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
      setMessage(`CSV Ingestion Completed! Caught ${data?.summary_report?.length || 0} active data anomalies.`);
    } catch (err) {
      setMessage("CSV Processing Engine failed to complete staging checks safely.");
    }
    setLoading(false);
  };

  const handleUpdateStagedField = (index, field, value) => {
    if (!stagedData) return;
    
    const updatedRecords = stagedData.records.map((rec, idx) => {
      if (idx === index) {
        return { ...rec, [field]: value };
      }
      return rec;
    });

    setStagedData({
      ...stagedData,
      records: updatedRecords
    });
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
      await fetchFinancialAnalytics();
      setActiveTab('dashboard');
    } catch (err) {
      setMessage("Transactional commit failed to apply updates safely.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] font-sans text-slate-800 antialiased">
      {/* Navigation Topbar Bar Header */}
      <header className="bg-[#1cc29f] text-white shadow-sm px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <span className="text-2xl font-black tracking-tight">🤝 CO-SPLIT</span>
          <span className="bg-[#148f75] text-[11px] px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider opacity-90">
            Splitwise UX Engine
          </span>
        </div>
        <div className="flex items-center space-x-4">
          {groups.length === 0 ? (
            <button onClick={initializeDefaultGroup} className="bg-[#ff6556] hover:bg-[#e05245] px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all">
              Initialize Flat Group
            </button>
          ) : (
            <div className="flex items-center space-x-2 bg-[#148f75] px-3 py-1.5 rounded-lg border border-[#19aa8b]">
              <span className="text-xs font-bold uppercase text-teal-100">Active Workspace:</span>
              <select 
                value={selectedGroupId || ""} 
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedGroupId(val === "" ? null : Number(val));
                }}
                className="bg-transparent text-white font-bold text-sm outline-none cursor-pointer"
              >
                {groups.map(g => <option key={g.id} value={g.id} className="text-slate-800 font-medium">{g.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </header>

      {/* Global Status Message Bar */}
      {message && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 font-medium px-6 py-3 text-sm flex justify-between items-center shadow-inner animate-fadeIn">
          <span className="flex items-center space-x-2">
            <span>🔔</span> <span>{message}</span>
          </span>
          <button onClick={() => setMessage("")} className="text-amber-400 hover:text-amber-900 font-bold text-lg">×</button>
        </div>
      )}

      {/* Primary Navigation Hub */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 flex space-x-2 mb-6">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold tracking-wide transition-all flex items-center justify-center space-x-2 ${activeTab === 'dashboard' ? 'bg-[#e9f9f5] text-[#1cc29f]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
          >
            <span>📊</span> <span>GROUP DASHBOARD</span>
          </button>
          <button 
            onClick={() => setActiveTab('audit')} 
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold tracking-wide transition-all flex items-center justify-center space-x-2 ${activeTab === 'audit' ? 'bg-[#e9f9f5] text-[#1cc29f]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
          >
            <span>🔍</span> <span>ITEMIZED AUDIT TRAILS</span>
          </button>
          <button 
            onClick={() => setActiveTab('import')} 
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold tracking-wide transition-all flex items-center justify-center space-x-2 ${activeTab === 'import' ? 'bg-[#e9f9f5] text-[#1cc29f]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
          >
            <span>📥</span> <span>CONTROL DATA IMPORTER</span>
          </button>
        </div>

        {/* --- MAIN INTERACTIVE VIEW CONTROLLERS --- */}
        <main className="pb-16">
          {loading && (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-[#1cc29f] mx-auto"></div>
              <p className="text-slate-500 text-xs mt-4 font-bold tracking-widest uppercase">COMPUTING RELATIONAL TRANSACTIONS...</p>
            </div>
          )}

          {/* TAB 1: MODERN ISOLATED SPLITWISE DASHBOARD */}
          {!loading && activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
              
              {/* LEFT SIDEBAR CONTROLS: Choose Table View */}
              <div className="md:col-span-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 mb-3">View Modes</h3>
                <button
                  onClick={() => setDashboardView('balances')}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between transition-all ${dashboardView === 'balances' ? 'bg-[#1cc29f] text-white shadow-md shadow-teal-100' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <span>💰 Net Pool Balances</span>
                  {dashboardView === 'balances' && <span className="text-xs">●</span>}
                </button>
                <button
                  onClick={() => setDashboardView('settlements')}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between transition-all ${dashboardView === 'settlements' ? 'bg-[#1cc29f] text-white shadow-md shadow-teal-100' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <span>⚡ Optimized Settlements</span>
                  {dashboardView === 'settlements' && <span className="text-xs">●</span>}
                </button>
              </div>

              {/* RIGHT WORKSPACE: Isolated Content Display */}
              <div className="md:col-span-3 space-y-6">
                
                {/* SUB-TAB A: RAW POOL NET BALANCES */}
                {dashboardView === 'balances' && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="mb-6">
                      <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Individual Balance Summary</h2>
                      <p className="text-xs text-slate-400 mt-1">Current net standing standing parameters evaluated for each active roommate.</p>
                    </div>
                    
                    {financials?.raw_net_balances && Object.keys(financials.raw_net_balances).length > 0 ? (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                        {Object.entries(financials.raw_net_balances).map(([name, netBalance]) => {
                          const settlementsForPerson = financials?.aisha_simplified_settlements?.filter(
                            s => s.from === name || s.to === name
                          ) || [];
                          
                          let totalOwes = 0;
                          let totalIsOwed = 0;
                          
                          settlementsForPerson.forEach(s => {
                            if (s.from === name) totalOwes += s.amount;
                            if (s.to === name) totalIsOwed += s.amount;
                          });

                          return (
                            <div key={name} className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between sm:items-center bg-white hover:bg-slate-50/60 transition-all">
                              <div className="flex items-center space-x-3 mb-3 sm:mb-0">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-inner ${netBalance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                  {name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-800 text-base">{name}</h4>
                                  <div className="flex items-center space-x-3 text-xs text-slate-400 font-medium mt-0.5">
                                    <span>Owes: <strong className="text-rose-500 font-semibold">₹{totalOwes.toLocaleString()}</strong></span>
                                    <span>•</span>
                                    <span>Owed: <strong className="text-emerald-600 font-semibold">₹{totalIsOwed.toLocaleString()}</strong></span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                                <div className={`text-lg font-black ${netBalance > 0 ? 'text-[#5bc5a7]' : netBalance < 0 ? 'text-[#ff6556]' : 'text-slate-500'}`}>
                                  {netBalance > 0 ? `gets back ₹${netBalance.toLocaleString()}` : netBalance < 0 ? `owes ₹${Math.abs(netBalance).toLocaleString()}` : 'settled up'}
                                </div>
                                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mt-0.5">
                                  {netBalance >= 0 ? '🟢 No Outstanding Action' : '🔴 Payment Required'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-slate-400 text-sm font-medium">📊 No ledger balances computed yet. Complete a data import pass.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-TAB B: OPTIMIZED SETTLEMENT STRATEGY */}
                {dashboardView === 'settlements' && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="mb-6">
                      <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Debt Minimization Strategy</h2>
                      <p className="text-xs text-slate-400 mt-1">Aisha's smart settlement matrix simplifies global transaction pools into minimal steps.</p>
                    </div>

                    {financials?.aisha_simplified_settlements && financials.aisha_simplified_settlements.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {financials.aisha_simplified_settlements.map((tx, idx) => (
                          <div key={idx} className="bg-[#f8f9fa] border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all flex flex-col justify-between">
                            <div className="flex justify-between items-center border-b border-slate-200/60 pb-3 mb-4">
                              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Settlement #{idx + 1}</span>
                              <span className="bg-teal-50 text-teal-700 text-[10px] px-2 py-0.5 rounded font-extrabold border border-teal-200">Optimized</span>
                            </div>

                            <div className="space-y-3">
                              <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                <span className="text-xs font-bold text-slate-500 uppercase">From Payer</span>
                                <span className="text-sm font-black text-rose-500 bg-rose-50 px-2.5 py-0.5 rounded-md">{tx.from}</span>
                              </div>
                              <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                <span className="text-xs font-bold text-slate-500 uppercase">To Recipient</span>
                                <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md">{tx.to}</span>
                              </div>
                            </div>

                            <div className="mt-5 pt-3 border-t border-slate-200/60 text-center">
                              <div className="text-2xl font-black text-slate-800 mb-2">₹{tx.amount.toLocaleString()}</div>
                              <button className="w-full bg-[#1cc29f] hover:bg-[#148f75] text-white py-2 rounded-lg text-xs font-bold transition-all shadow-sm">
                                ✓ Mark As Settled
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 rounded-2xl border border-dashed border-emerald-200">
                        <span className="text-4xl block mb-2">✨</span>
                        <p className="text-slate-700 font-bold">Ledger system is perfectly balanced!</p>
                        <p className="text-xs text-slate-400 mt-0.5">No outstanding payments or split debt detected.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ROHAN'S ITEMIZED AUDIT VIEW */}
          {!loading && activeTab === 'audit' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="mb-5">
                  <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">Audit Ledger Tracking Console</h3>
                  <p className="text-xs text-slate-400 mt-1">Select a group participant below to query their full individual trace histories.</p>
                </div>

                <div className="flex flex-wrap gap-2 p-1.5 bg-slate-50 rounded-xl border border-slate-200">
                  {["Aisha", "Rohan", "Priya", "Meera", "Sam", "Dev"].map(u => (
                    <button 
                      key={u} 
                      onClick={() => setSelectedAuditUser(u)}
                      className={`flex-1 min-w-[80px] py-2.5 px-3 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${selectedAuditUser === u ? 'bg-white text-[#1cc29f] shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transaction Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {financials?.rohan_itemized_audit_trail && financials.rohan_itemized_audit_trail[selectedAuditUser]?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                          <th className="py-4 px-6">Effective Date</th>
                          <th className="py-4 px-6">Line Description</th>
                          <th className="py-4 px-6">Allocation Mapping</th>
                          <th className="py-4 px-6 text-right">Impact Delta (INR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {financials.rohan_itemized_audit_trail[selectedAuditUser].map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-all">
                            <td className="py-4 px-6 font-mono text-xs text-slate-400">{item.date}</td>
                            <td className="py-4 px-6 font-bold text-slate-700">{item.description}</td>
                            <td className="py-4 px-6 text-xs text-slate-400 italic font-medium">{item.context}</td>
                            <td className={`py-4 px-6 font-black text-right text-base ${item.type === 'CREDIT_DUE' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {item.type === 'CREDIT_DUE' ? `+₹${item.amount.toFixed(2)}` : `-₹${item.amount.toFixed(2)}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400 text-sm font-medium bg-slate-50">
                    📭 No line-item allocation history found for {selectedAuditUser}.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MEERA'S CONTROL DATA IMPORT ENGINE */}
          {!loading && activeTab === 'import' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center max-w-2xl mx-auto">
                <div className="w-16 h-16 bg-teal-50 text-[#1cc29f] rounded-full flex items-center justify-center text-2xl mx-auto mb-4 border border-teal-100">
                  📁
                </div>
                <h3 className="text-lg font-extrabold text-slate-800 tracking-tight mb-2">Ingestion Engine Panel</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
                  Upload raw <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-teal-600 font-bold">expenses_export.csv</code> sheets. 
                  The layout engine parsing maps will extract, evaluate, and lock anomalies natively.
                </p>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 hover:bg-slate-100/50 transition-all cursor-pointer relative">
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleCsvFileUpload} 
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <span className="text-xs font-bold text-slate-500">Click to pick or drop target expense files</span>
                </div>
              </div>

              <div className="p-5 border border-slate-200 rounded-2xl bg-white max-w-2xl mx-auto shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Database Core Infrastructure Config</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Preseed empty schema instances or drop existing records.</p>
                </div>
                <button 
                  onClick={handleInitializeGroup}
                  className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl transition-all ${initStatus === "success" ? "bg-emerald-600 text-white cursor-default" : "bg-slate-800 text-white hover:bg-slate-900 shadow-sm"}`}
                  disabled={initStatus === "loading" || initStatus === "success"}
                >
                  {initStatus === "loading" && "🔄 Building Schema..."}
                  {initStatus === "success" && "✅ Infrastructure Safe"}
                  {initStatus !== "loading" && initStatus !== "success" && "⚡ Seed Infrastructure Mapping"}
                </button>
              </div>

              {/* Dynamic Staging Report Table Matrix */}
              {stagedData?.records && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-slideUp">
                  <div className="bg-slate-900 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-white space-y-3 sm:space-y-0">
                    <div>
                      <h4 className="text-sm font-black tracking-wide text-teal-400 uppercase">Pipeline Sandbox Matrix</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{stagedData.records.length} records staging. Verify structural parameters before syncing.</p>
                    </div>
                    <button onClick={commitApprovedDataToDb} className="w-full sm:w-auto bg-[#1cc29f] hover:bg-[#148f75] px-5 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all uppercase shadow-md">
                      💾 Sync & Commit to Database
                    </button>
                  </div>

                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 text-slate-500 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4 text-center">Row</th>
                          <th className="py-3 px-4 w-32">Effective Date</th>
                          <th className="py-3 px-4">Description</th>
                          <th className="py-3 px-4 w-32">Payer Account</th>
                          <th className="py-3 px-4 text-right">Amt</th>
                          <th className="py-3 px-4 text-center">Curr</th>
                          <th className="py-3 px-4 text-right w-32">Unified (INR)</th>
                          <th className="py-3 px-4 w-48">Anomalies Detected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stagedData.records.map((rec, idx) => {
                          const hasCritical = rec.anomalies?.some(a => a.severity === 'CRITICAL');
                          const hasHigh = rec.anomalies?.some(a => a.severity === 'HIGH');
                          const rowColor = hasCritical ? 'bg-rose-50/60' : hasHigh ? 'bg-amber-50/40' : 'hover:bg-slate-50/50';

                          return (
                            <tr key={idx} className={`${rowColor} transition-all`}>
                              <td className="py-3 px-4 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                              <td className="py-2 px-2">
                                <input 
                                  type="text" 
                                  value={rec.date || ""} 
                                  onChange={(e) => handleUpdateStagedField(idx, 'date', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono text-xs outline-none"
                                />
                              </td>
                              <td className="py-2 px-2 font-bold text-slate-700">{rec.description}</td>
                              <td className="py-2 px-2">
                                <input 
                                  type="text" 
                                  value={rec.paid_by || ""} 
                                  placeholder="MISSING"
                                  onChange={(e) => handleUpdateStagedField(idx, 'paid_by', e.target.value)}
                                  className={`w-full border rounded-lg px-2 py-1 text-xs font-bold outline-none ${!rec.paid_by ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white text-slate-700'}`}
                                />
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-600">{rec.amount}</td>
                              <td className="py-3 px-4 text-center font-bold text-slate-400">{rec.currency}</td>
                              <td className="py-2 px-2">
                                <input 
                                  type="number" 
                                  value={rec.amount_in_inr || 0} 
                                  onChange={(e) => handleUpdateStagedField(idx, 'amount_in_inr', Number(e.target.value))}
                                  className="w-full text-right bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-black text-slate-700 text-xs outline-none"
                                />
                              </td>
                              <td className="py-3 px-4">
                                {rec.anomalies && rec.anomalies.length > 0 ? (
                                  <div className="flex flex-col gap-1">
                                    {rec.anomalies.map((anom, aIdx) => (
                                      <span 
                                        key={aIdx} 
                                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide truncate max-w-[180px] ${anom.severity === 'CRITICAL' ? 'bg-rose-600 text-white' : anom.severity === 'HIGH' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700'}`}
                                        title={anom.message}
                                      >
                                        ⚠️ [{anom.type}] {anom.message}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-emerald-600 font-extrabold text-[10px] uppercase tracking-wider">✓ Valid</span>
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
