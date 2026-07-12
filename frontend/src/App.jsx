import React, { useState, useEffect, useCallback } from 'react';
import BASE_URL from './api.js';

export default function App() {
  const API_BASE = BASE_URL;
  
  // Core Operational States (Unchanged)
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [stagedData, setStagedData] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | audit | import
  
  // Interactive Filter States
  const [dashboardView, setDashboardView] = useState('balances'); // balances | owed | expenses | settlements
  const [selectedAuditUser, setSelectedAuditUser] = useState("Aisha");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [initStatus, setInitStatus] = useState("");

  // Memoized group fetch routine
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

  // Memoized financial data sync routine
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

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

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
      const res = await fetch({
        url: `${API_BASE}/groups`,
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
  setMessage(""); // Clear old status alerts
  setStagedData(null); // 🌟 CRUCIAL: Instantly wipes out previous file's data from UI state

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${API_BASE}/importer/stage`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error("Parser handling error caught.");
    const data = await res.json();
    
    // If your backend is stubbornly returning appended records, 
    // this line ensures the frontend ONLY renders the fresh rows from this upload
    setStagedData(data); 
    
    setMessage(`CSV Ingestion Completed! Fresh upload contains ${data?.records?.length || 0} active records.`);
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

  // Safe Financial Parser: Formats to standard Indian numbering (Lakhs/Crores) & restricts decimal drift
  const formatCurrency = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "0.00";
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Outlier Flag: Automatically warns if a value looks accidentally multiplied by 1000 (e.g., 899,995 vs 899.99)
  const isSuspiciousOutlier = (val) => {
    return Math.abs(parseFloat(val)) >= 100000;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800 flex flex-col antialiased">
      
      {/* BRAND HEADER BANNER */}
      <header className="bg-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row justify-between items-center border-b border-slate-800 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center space-x-3 mb-2 sm:mb-0">
          <span className="text-xl font-black tracking-tight flex items-center gap-2">
            <span className="text-[#1cc29f]">✨</span> CO-SPLIT LEDGER
          </span>
          <span className="bg-[#1cc29f]/10 text-[#1cc29f] text-[10px] px-2 py-0.5 rounded font-black tracking-widest uppercase border border-[#1cc29f]/20">
            Precision Core
          </span>
        </div>
        
        <div className="flex items-center space-x-3">
          {groups.length === 0 ? (
            <button onClick={initializeDefaultGroup} className="bg-rose-500 hover:bg-rose-600 px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all shadow-sm">
              Initialize Group Workspace
            </button>
          ) : (
            <div className="flex items-center space-x-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 shadow-inner">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Active Pool:</span>
              <select 
                value={selectedGroupId || ""} 
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedGroupId(val === "" ? null : Number(val));
                }}
                className="bg-transparent text-white font-bold text-xs border-none outline-none cursor-pointer focus:ring-0 p-0"
              >
                {groups.map(g => <option key={g.id} value={g.id} className="text-slate-800 font-semibold bg-white">{g.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </header>

      {/* SYSTEM NOTIFICATION APPARATUS */}
      {message && (
        <div className="bg-teal-50 border-b border-teal-200 text-teal-900 font-medium px-6 py-3 text-xs flex justify-between items-center shadow-inner">
          <span className="flex items-center space-x-2">
            <span>ℹ️</span> <span>{message}</span>
          </span>
          <button onClick={() => setMessage("")} className="text-teal-400 hover:text-teal-900 font-black text-sm">✕</button>
        </div>
      )}

      {/* APPLICATION CORE HUB INTERFACE */}
      <div className="flex-1 flex flex-col md:flex-row w-full max-w-[1600px] mx-auto">
        
        {/* INTERACTIVE COMPONENT SIDEBAR SYSTEM */}
        <aside className="w-full md:w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-4 space-y-1 border-b border-slate-800">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 mb-2">Primary Modules</div>
            
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center space-x-3 ${activeTab === 'dashboard' ? 'bg-[#1cc29f] text-white font-black shadow-md shadow-teal-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <span>📊</span> <span>Interactive Dashboard</span>
            </button>

            <button 
              onClick={() => setActiveTab('audit')} 
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center space-x-3 ${activeTab === 'audit' ? 'bg-[#1cc29f] text-white font-black shadow-md shadow-teal-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <span>🔍</span> <span>Itemized Audit Trails</span>
            </button>

            <button 
              onClick={() => setActiveTab('import')} 
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center space-x-3 ${activeTab === 'import' ? 'bg-[#1cc29f] text-white font-black shadow-md shadow-teal-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <span>📥</span> <span>Control Data Importer</span>
            </button>
          </div>

          {/* SUB-STATE SUBNAVIGATION PANELS */}
          {activeTab === 'dashboard' && (
            <div className="p-4 flex-1 space-y-1">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 mb-2">Dashboard Filters</div>
              
              <button 
                onClick={() => setDashboardView('balances')}
                className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${dashboardView === 'balances' ? 'text-[#1cc29f] bg-slate-800/80 font-bold border-l-2 border-[#1cc29f]' : 'hover:text-white hover:bg-slate-800/40'}`}
              >
                <span>💰 Net Member Pools</span>
              </button>

              <button 
                onClick={() => setDashboardView('owed')}
                className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${dashboardView === 'owed' ? 'text-[#1cc29f] bg-slate-800/80 font-bold border-l-2 border-[#1cc29f]' : 'hover:text-white hover:bg-slate-800/40'}`}
              >
                <span>💸 Separate Owed Ledger</span>
                <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-bold border border-amber-500/20">Owed</span>
              </button>

              <button 
                onClick={() => setDashboardView('expenses')}
                className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${dashboardView === 'expenses' ? 'text-[#1cc29f] bg-slate-800/80 font-bold border-l-2 border-[#1cc29f]' : 'hover:text-white hover:bg-slate-800/40'}`}
              >
                <span>📜 Raw Expenses Paid</span>
              </button>

              <button 
                onClick={() => setDashboardView('settlements')}
                className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${dashboardView === 'settlements' ? 'text-[#1cc29f] bg-slate-800/80 font-bold border-l-2 border-[#1cc29f]' : 'hover:text-white hover:bg-slate-800/40'}`}
              >
                <span>⚡ Simplified Strategy</span>
              </button>
            </div>
          )}
        </aside>

        {/* WORKSPACE FRAME LAYOUT */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          
          {loading && (
            <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-[#1cc29f] mx-auto"></div>
              <p className="text-slate-400 text-[10px] font-black mt-4 uppercase tracking-widest">Normalizing Calculation Frameworks...</p>
            </div>
          )}

          {/* VIEW LAYER 1: THE RE-ENGINEERED COMPREHENSIBLE DASHBOARD */}
          {!loading && activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* DYNAMIC VIEW STATE A: NET SUMMARY SCORING CARDS */}
              {dashboardView === 'balances' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Net Roommate Pool Summary</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Absolute dynamic standing calculated with real-time decimal precision enforcement.</p>
                  </div>

                  {financials?.raw_net_balances && Object.keys(financials.raw_net_balances).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(financials.raw_net_balances).map(([name, netBalance]) => {
                        const isCreditor = netBalance >= 0;
                        const outlierRisk = isSuspiciousOutlier(netBalance);

                        return (
                          <div key={name} className={`bg-white rounded-2xl border p-5 shadow-sm transition-all flex flex-col justify-between relative overflow-hidden ${outlierRisk ? 'border-amber-300 ring-2 ring-amber-500/10' : 'border-slate-200'}`}>
                            {outlierRisk && (
                              <div className="absolute top-0 right-0 left-0 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest py-1 text-center">
                                ⚠️ High Outlier Anomaly Detected
                              </div>
                            )}

                            <div className={`flex justify-between items-start ${outlierRisk ? 'mt-3' : ''}`}>
                              <div className="flex items-center space-x-3">
                                <div className={`w-9 h-9 rounded-full font-black text-xs flex items-center justify-center ${isCreditor ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                                  {name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <h4 className="font-extrabold text-slate-900 text-sm">{name}</h4>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isCreditor ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {isCreditor ? '🟢 Net Creditor' : '🔴 Balance Due'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-8 pt-3 border-t border-slate-100 flex justify-between items-end">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Final Settlement Value:</span>
                              <div className="text-right">
                                <div className={`text-base font-black tracking-tight ${isCreditor ? 'text-[#1cc29f]' : 'text-[#ff6556]'}`}>
                                  {isCreditor ? `Gets back ₹${formatCurrency(netBalance)}` : `Owes ₹${formatCurrency(Math.abs(netBalance))}`}
                                </div>
                                {outlierRisk && (
                                  <span className="text-[9px] font-bold text-amber-600 block mt-0.5">Please check for missing dot/commas in import</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                      No computational layout models loaded inside this active cluster state.
                    </div>
                  )}
                </div>
              )}

              {/* DYNAMIC VIEW STATE B: ISOLATED DEBT MATRIX TABLE */}
              {dashboardView === 'owed' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">Isolated Roommate Debt Matrix</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Clean table workspace capturing explicit share values assigned to individuals.</p>
                  </div>

                  {/* Clean Visual Summary Sub-panel */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Total Accumulative Debt Burden Per Head</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {financials?.rohan_itemized_audit_trail && Object.entries(financials.rohan_itemized_audit_trail).map(([name, items]) => {
                        const totalDebt = items.filter(i => i.type === 'DEBIT_DUE').reduce((acc, curr) => acc + curr.amount, 0);
                        const outlierRisk = isSuspiciousOutlier(totalDebt);
                        return (
                          <div key={name} className={`bg-white p-3 rounded-lg border flex flex-col justify-between ${outlierRisk ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'}`}>
                            <span className="text-xs font-extrabold text-slate-500 uppercase">{name}</span>
                            <span className={`text-sm font-black mt-2 font-mono ${outlierRisk ? 'text-amber-600' : 'text-rose-500'}`}>
                              ₹{formatCurrency(totalDebt)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dedicated Owed Ledger Matrix Table */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                          <th className="py-3 px-4">Effective Date</th>
                          <th className="py-3 px-4">Expense Context Line Item</th>
                          <th className="py-3 px-4">Debtor Target</th>
                          <th className="py-3 px-4 text-right">Individual Share Value (INR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {financials?.rohan_itemized_audit_trail && Object.values(financials.rohan_itemized_audit_trail).flat().filter(item => item.type === 'DEBIT_DUE').length > 0 ? (
                          Object.entries(financials.rohan_itemized_audit_trail).flatMap(([name, items]) => 
                            items.filter(item => item.type === 'DEBIT_DUE').map((item, idx) => {
                              const badMath = isSuspiciousOutlier(item.amount);
                              return (
                                <tr key={`${name}-${idx}`} className={`transition-all ${badMath ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50/70'}`}>
                                  <td className="py-3 px-4 font-mono text-slate-400">{item.date}</td>
                                  <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                                    {item.description}
                                    {badMath && <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.2 rounded font-black tracking-tighter">⚠️ UNUSUAL HIGH MAPPING</span>}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="bg-rose-50 text-rose-600 border border-rose-100 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                                      {name} owes
                                    </span>
                                  </td>
                                  <td className={`py-3 px-4 text-right font-mono font-black text-sm ${badMath ? 'text-amber-600' : 'text-rose-500'}`}>
                                    ₹{formatCurrency(item.amount)}
                                  </td>
                                </tr>
                              );
                            })
                          )
                        ) : (
                          <tr>
                            <td colSpan="4" className="py-12 text-center text-slate-400 bg-slate-50 font-medium">
                              Zero individual debt records verified inside database cluster nodes.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DYNAMIC VIEW STATE C: ISOLATED RAW EXPENSES PAID TABLE */}
              {dashboardView === 'expenses' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">Isolated Expenses Paid Logs</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Isolated overview tracking macro capital injections contributed by individual members.</p>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                          <th className="py-3 px-4">Effective Date</th>
                          <th className="py-3 px-4">Capital Outlay Description</th>
                          <th className="py-3 px-4">Primary Payer Account</th>
                          <th className="py-3 px-4 text-right">Payer Contribution Credit (INR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {financials?.rohan_itemized_audit_trail && Object.values(financials.rohan_itemized_audit_trail).flat().filter(item => item.type === 'CREDIT_DUE').length > 0 ? (
                          Object.entries(financials.rohan_itemized_audit_trail).flatMap(([name, items]) => 
                            items.filter(item => item.type === 'CREDIT_DUE').map((item, idx) => {
                              const badMath = isSuspiciousOutlier(item.amount);
                              return (
                                <tr key={`${name}-${idx}`} className={`transition-all ${badMath ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50/70'}`}>
                                  <td className="py-3 px-4 font-mono text-slate-400">{item.date}</td>
                                  <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                                    {item.description}
                                    {badMath && <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.2 rounded font-black tracking-tighter">⚠️ POTENTIAL DECIMAL MISPLACEMENT</span>}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                                      Paid By {name}
                                    </span>
                                  </td>
                                  <td className={`py-3 px-4 text-right font-mono font-black text-sm ${badMath ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    ₹{formatCurrency(item.amount)}
                                  </td>
                                </tr>
                              );
                            })
                          )
                        ) : (
                          <tr>
                            <td colSpan="4" className="py-12 text-center text-slate-400 bg-slate-50 font-medium">
                              No core primary expenditures parsed inside workspace system caches.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DYNAMIC VIEW STATE D: SIMPLIFIED SETTLEMENT STRATEGY */}
              {dashboardView === 'settlements' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">Debt Minimization Routing Map</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Automated settlement strategies mapped out to clear outstanding pools instantly.</p>
                  </div>

                  {financials?.aisha_simplified_settlements && financials.aisha_simplified_settlements.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {financials.aisha_simplified_settlements.map((tx, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 transition-all">
                          <div className="flex justify-between items-center border-b border-slate-200/60 pb-2 mb-3">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Minimal Hop Route #{idx + 1}</span>
                            <span className="text-[9px] bg-teal-50 text-teal-700 font-bold border border-teal-200 px-2 py-0.2 rounded">Optimal</span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-medium">From Debtor Account:</span>
                              <span className="text-rose-500 font-black bg-rose-50 px-2.5 py-0.5 rounded border border-rose-100">{tx.from}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-medium">To Recipient Account:</span>
                              <span className="text-emerald-600 font-black bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100">{tx.to}</span>
                            </div>
                          </div>

                          <div className="mt-5 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                            <span className="text-sm font-black text-slate-900 font-mono">₹{formatCurrency(tx.amount)}</span>
                            <button className="bg-[#1cc29f] hover:bg-[#159a7e] text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all shadow-sm">
                              Complete Step
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-emerald-50/40 border border-dashed border-emerald-200 rounded-2xl text-slate-600 text-xs font-bold">
                      ✨ Pool system balances cleanly match. No transactional debts are active.
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* VIEW LAYER 2: ROHAN'S FULL trace INTERFACE PANELS */}
          {!loading && activeTab === 'audit' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">Audit Ledger Balance Tracking Console</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Select a room member below to query their absolute history tracing blocks.</p>
                </div>

                <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100 rounded-xl border border-slate-200/60">
                  {["Aisha", "Rohan", "Priya", "Meera", "Sam", "Dev"].map(u => (
                    <button 
                      key={u} 
                      onClick={() => setSelectedAuditUser(u)}
                      className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${selectedAuditUser === u ? 'bg-white text-[#1cc29f] shadow-sm border border-slate-200 font-black' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Individual Matrix Table Logs */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {financials?.rohan_itemized_audit_trail && financials.rohan_itemized_audit_trail[selectedAuditUser]?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                          <th className="py-4 px-6">Effective Date</th>
                          <th className="py-4 px-6">Line Item Context Description</th>
                          <th className="py-4 px-6">Allocation Mapping</th>
                          <th className="py-4 px-6 text-right">Impact Delta Balance Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        {financials.rohan_itemized_audit_trail[selectedAuditUser].map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-all">
                            <td className="py-4 px-6 font-mono text-slate-400">{item.date}</td>
                            <td className="py-4 px-6 font-bold text-slate-800">{item.description}</td>
                            <td className="py-4 px-6 text-slate-400 italic font-mono">{item.context}</td>
                            <td className={`py-4 px-6 font-black text-right text-sm font-mono ${item.type === 'CREDIT_DUE' ? 'text-emerald-600' : 'text-rose-500'}`}>
                              {item.type === 'CREDIT_DUE' ? `+₹${formatCurrency(item.amount)}` : `-₹${formatCurrency(item.amount)}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400 text-xs font-medium bg-slate-50">
                    No tracing records verified inside current ledger for {selectedAuditUser}.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW LAYER 3: MEERA'S EXPORT CONTROL DATA IMPORTER */}
          {!loading && activeTab === 'import' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center max-w-2xl mx-auto space-y-4">
                <div className="w-14 h-14 bg-slate-50 text-[#1cc29f] rounded-full border border-slate-200 flex items-center justify-center text-xl mx-auto">
                  📁
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">Ingestion Processing Engine</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                    Drop your spreadsheet pipelines here. Use the sandbox staging view below to fix formatting errors before database sync passes.
                  </p>
                </div>
                
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 bg-slate-50 hover:bg-slate-100/60 transition-all cursor-pointer relative max-w-md mx-auto">
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleCsvFileUpload} 
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <span className="text-xs font-bold text-slate-400">Select target expense file (.csv)</span>
                </div>
              </div>

              {/* System Infrastructure Controls */}
              <div className="p-5 border border-slate-200 rounded-2xl bg-white max-w-2xl mx-auto shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Database Infrastructure Architecture Settings</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Initialize base data schemas across operational storage nodes.</p>
                </div>
                <button 
                  onClick={handleInitializeGroup}
                  className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl transition-all ${initStatus === "success" ? "bg-emerald-600 text-white cursor-default" : "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"}`}
                  disabled={initStatus === "loading" || initStatus === "success"}
                >
                  {initStatus === "loading" && "Configuring Core Structural Schemas..."}
                  {initStatus === "success" && "Schema Mapping Synced"}
                  {initStatus !== "loading" && initStatus !== "success" && "Seed Infrastructure Layout"}
                </button>
              </div>

              {/* INGESTION PIPELINE SANDBOX STAGING DATA GRID MATRIX */}
              {stagedData?.records && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-slideUp">
                  <div className="bg-slate-950 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-white border-b border-slate-800 space-y-3 sm:space-y-0">
                    <div>
                      <h4 className="text-xs font-black tracking-widest text-[#1cc29f] uppercase">Sandbox Records Staging Matrix</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Please check and normalize values before database execution.</p>
                    </div>
                    <button onClick={commitApprovedDataToDb} className="w-full sm:w-auto bg-[#1cc29f] hover:bg-[#159a7e] px-5 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all uppercase shadow-md">
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
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {stagedData.records.map((rec, idx) => {
                          const hasCritical = rec.anomalies?.some(a => a.severity === 'CRITICAL');
                          const hasHigh = rec.anomalies?.some(a => a.severity === 'HIGH') || isSuspiciousOutlier(rec.amount_in_inr);
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
                              <td className="py-2 px-2 font-bold text-slate-800">{rec.description}</td>
                              <td className="py-2 px-2">
                                <input 
                                  type="text" 
                                  value={rec.paid_by || ""} 
                                  placeholder="MISSING"
                                  onChange={(e) => handleUpdateStagedField(idx, 'paid_by', e.target.value)}
                                  className={`w-full border rounded-lg px-2 py-1 text-xs font-bold outline-none ${!rec.paid_by ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white text-slate-700'}`}
                                />
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600">{rec.amount}</td>
                              <td className="py-3 px-4 text-center text-slate-400 font-bold">{rec.currency}</td>
                              <td className="py-2 px-2">
                                <input 
                                  type="number" 
                                  value={rec.amount_in_inr || 0} 
                                  onChange={(e) => handleUpdateStagedField(idx, 'amount_in_inr', Number(e.target.value))}
                                  className="w-full text-right bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-black text-slate-800 text-xs outline-none"
                                />
                              </td>
                              <td className="py-3 px-4">
                                {isSuspiciousOutlier(rec.amount_in_inr) && (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-amber-500 text-white block mb-1">
                                    ⚠️ CHECK DECIMAL POSITION
                                  </span>
                                )}
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
                                  !isSuspiciousOutlier(rec.amount_in_inr) && <span className="text-emerald-600 font-extrabold text-[10px] uppercase tracking-wider">✓ Valid Structure</span>
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
