import React, { useState, useEffect, useCallback } from 'react';
import BASE_URL from './api.js';

export default function App() {
  const API_BASE = BASE_URL;
  
  // App Core State Layers (Unchanged)
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [stagedData, setStagedData] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | audit | import
  
  // Modern Layout Sub-View Navigation State
  const [dashboardView, setDashboardView] = useState('balances'); // balances | expenses | owed | settlements
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

  // Safe arithmetic parser to clean precision errors (like .463 or .217) safely in UI layer
  const formatCurrency = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? "0.00" : num.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans text-slate-800 flex flex-col antialiased">
      
      {/* GLOBAL APPARATUS NAVBAR HEADER */}
      <header className="bg-slate-950 text-white shadow-md px-6 py-4 flex flex-col sm:flex-row justify-between items-center border-b border-slate-800 sticky top-0 z-50">
        <div className="flex items-center space-x-3 mb-3 sm:mb-0">
          <span className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <span className="text-[#1cc29f]">⚖</span> CO-SPLIT INTERACTIVE
          </span>
          <span className="bg-[#1cc29f]/20 text-[#1cc29f] text-[10px] px-2 py-0.5 rounded font-extrabold uppercase tracking-widest border border-[#1cc29f]/30">
            PRO HUB
          </span>
        </div>
        
        <div className="flex items-center space-x-3">
          {groups.length === 0 ? (
            <button onClick={initializeDefaultGroup} className="bg-[#ff6556] hover:bg-[#e05245] px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider shadow transition-all">
              Initialize Flat Group
            </button>
          ) : (
            <div className="flex items-center space-x-2 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 shadow-inner">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Workspace:</span>
              <select 
                value={selectedGroupId || ""} 
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedGroupId(val === "" ? null : Number(val));
                }}
                className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer border-none p-0 focus:ring-0"
              >
                {groups.map(g => <option key={g.id} value={g.id} className="text-slate-800 font-semibold bg-white">{g.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </header>

      {/* SYSTEM MESSAGE ALERT SYSTEM */}
      {message && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 font-medium px-6 py-3 text-xs flex justify-between items-center shadow-inner animate-fadeIn">
          <span className="flex items-center space-x-2">
            <span>✨</span> <span>{message}</span>
          </span>
          <button onClick={() => setMessage("")} className="text-amber-400 hover:text-amber-900 font-bold text-sm">✕</button>
        </div>
      )}

      {/* MAIN CONTAINER PLATFORM WITH SIDEBAR ENGINE */}
      <div className="flex-1 flex flex-col md:flex-row max-w-[1600px] w-full mx-auto">
        
        {/* INTERACTIVE COMPONENT SIDEBAR SYSTEM */}
        <aside className="w-full md:w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col shrink-0">
          {/* Main Module Controls */}
          <div className="p-4 space-y-1 border-b border-slate-800">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 mb-2">Primary Modules</div>
            
            <button 
              onClick={() => { setActiveTab('dashboard'); }} 
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center space-x-3 ${activeTab === 'dashboard' ? 'bg-[#1cc29f] text-white font-black shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <span className="text-sm">📊</span> <span>Interactive Dashboard</span>
            </button>

            <button 
              onClick={() => { setActiveTab('audit'); }} 
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center space-x-3 ${activeTab === 'audit' ? 'bg-[#1cc29f] text-white font-black shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <span className="text-sm">🔍</span> <span>Itemized Audit Trails</span>
            </button>

            <button 
              onClick={() => { setActiveTab('import'); }} 
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center space-x-3 ${activeTab === 'import' ? 'bg-[#1cc29f] text-white font-black shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <span className="text-sm">📥</span> <span>Control Data Importer</span>
            </button>
          </div>

          {/* Sub-View Control Options for Dashboard Sub-States */}
          {activeTab === 'dashboard' && (
            <div className="p-4 flex-1 space-y-1">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 mb-2">Dashboard Filters</div>
              
              <button 
                onClick={() => setDashboardView('balances')}
                className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${dashboardView === 'balances' ? 'text-[#1cc29f] bg-slate-800/60 font-bold border-l-2 border-[#1cc29f]' : 'hover:text-white hover:bg-slate-800/40'}`}
              >
                <span>💰 Net Member Pools</span>
                <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">Total</span>
              </button>

              <button 
                onClick={() => setDashboardView('owed')}
                className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${dashboardView === 'owed' ? 'text-[#1cc29f] bg-slate-800/60 font-bold border-l-2 border-[#1cc29f]' : 'hover:text-white hover:bg-slate-800/40'}`}
              >
                <span>💸 Separate Owed Ledger</span>
                <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-bold border border-amber-500/20">Owed</span>
              </button>

              <button 
                onClick={() => setDashboardView('expenses')}
                className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${dashboardView === 'expenses' ? 'text-[#1cc29f] bg-slate-800/60 font-bold border-l-2 border-[#1cc29f]' : 'hover:text-white hover:bg-slate-800/40'}`}
              >
                <span>📜 Raw Expenses Paid</span>
                <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">Paid</span>
              </button>

              <button 
                onClick={() => setDashboardView('settlements')}
                className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${dashboardView === 'settlements' ? 'text-[#1cc29f] bg-slate-800/60 font-bold border-l-2 border-[#1cc29f]' : 'hover:text-white hover:bg-slate-800/40'}`}
              >
                <span>⚡ Simplified Strategy</span>
                <span className="text-[9px] bg-teal-500/10 text-teal-400 px-1.5 py-0.5 rounded font-bold border border-teal-500/20">Auto</span>
              </button>
            </div>
          )}

          {/* Sidebar Footer Context Branding */}
          <div className="p-4 text-[10px] text-slate-600 border-t border-slate-800 font-mono tracking-tight">
            Production Ledger Matrix v4.26
          </div>
        </aside>

        {/* WORKSPACE LAYOUT CONTAINER FRAME */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          
          {loading && (
            <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-[#1cc29f] mx-auto"></div>
              <p className="text-slate-400 text-[10px] font-black mt-4 uppercase tracking-widest">Recalculating absolute metrics...</p>
            </div>
          )}

          {/* TAB 1: INTERACTIVE SPLITWISE DASHBOARD INTERFACES */}
          {!loading && activeTab === 'dashboard' && (
            <div className="space-y-6">

              {/* DYNAMIC VIEW LAYER 1: MULTI-PARTY BALANCE SUMMARY CARDS */}
              {dashboardView === 'balances' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Net Member Pool Summary</h2>
                    <p className="text-xs text-slate-500">Real-time balances with fixed currency precision logic.</p>
                  </div>

                  {financials?.raw_net_balances && Object.keys(financials.raw_net_balances).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(financials.raw_net_balances).map(([name, netBalance]) => {
                        const isCreditor = netBalance >= 0;
                        return (
                          <div key={name} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center space-x-3">
                                <div className={`w-9 h-9 rounded-full font-black text-xs flex items-center justify-center ${isCreditor ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                                  {name.substring(0,2).toUpperCase()}
                                </div>
                                <div>
                                  <h4 className="font-extrabold text-slate-900 text-sm">{name}</h4>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isCreditor ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {isCreditor ? '🟢 Clear Standing' : '🔴 Action Required'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-6 pt-3 border-t border-slate-100 flex justify-between items-end">
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Calculated State:</span>
                              <div className="text-right">
                                <div className={`text-base font-black tracking-tight ${isCreditor ? 'text-[#1cc29f]' : 'text-[#ff6556]'}`}>
                                  {isCreditor ? `Gets back ₹${formatCurrency(netBalance)}` : `Owes ₹${formatCurrency(Math.abs(netBalance))}`}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                      No active financial records loaded inside this specific workspace ledger.
                    </div>
                  )}
                </div>
              )}

              {/* DYNAMIC VIEW LAYER 2: ISOLATED INDIVIDUALS OWED DETAILS VIEW */}
              {dashboardView === 'owed' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">Isolated Roommate Debt Matrix</h2>
                    <p className="text-xs text-slate-500">Dedicated operational pipeline rendering individual debt calculations only.</p>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                          <th className="py-3.5 px-4">Effective Date</th>
                          <th className="py-3.5 px-4">Expense Context Description</th>
                          <th className="py-3.5 px-4">Debtor Assignment</th>
                          <th className="py-3.5 px-4 text-right">Absolute Share Debt (INR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {financials?.rohan_itemized_audit_trail && Object.values(financials.rohan_itemized_audit_trail).flat().filter(item => item.type === 'DEBIT_DUE').length > 0 ? (
                          Object.entries(financials.rohan_itemized_audit_trail).flatMap(([name, items]) => 
                            items.filter(item => item.type === 'DEBIT_DUE').map((item, idx) => (
                              <tr key={`${name}-${idx}`} className="hover:bg-slate-50/70 transition-all">
                                <td className="py-3 px-4 font-mono text-slate-400">{item.date}</td>
                                <td className="py-3 px-4 font-bold text-slate-800">{item.description}</td>
                                <td className="py-3 px-4">
                                  <span className="bg-rose-50 text-rose-600 border border-rose-100 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                                    {name} owes
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-black text-rose-500 text-sm">
                                  ₹{formatCurrency(item.amount)}
                                </td>
                              </tr>
                            ))
                          )
                        ) : (
                          <tr>
                            <td colSpan="4" className="py-12 text-center text-slate-400 bg-slate-50 font-medium">
                              No active structural debt shares are recorded. All balances are settled.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Individual Cumulative Total Metrics */}
                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Individual Debt Accumulations</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {financials?.rohan_itemized_audit_trail && Object.entries(financials.rohan_itemized_audit_trail).map(([name, items]) => {
                        const totalDebt = items.filter(i => i.type === 'DEBIT_DUE').reduce((acc, curr) => acc + curr.amount, 0);
                        return (
                          <div key={name} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
                            <span className="text-xs font-extrabold text-slate-600 uppercase">{name}</span>
                            <span className="text-base font-black text-rose-500 mt-2 font-mono">₹{formatCurrency(totalDebt)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* DYNAMIC VIEW LAYER 3: RAW PAID EXPENSES SUMMARY LOGS */}
              {dashboardView === 'expenses' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">Isolated Expenses Paid Logs</h2>
                    <p className="text-xs text-slate-500">Isolated transaction tracking log capturing raw primary capital outlays.</p>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                          <th className="py-3.5 px-4">Effective Date</th>
                          <th className="py-3.5 px-4">Outlay Description</th>
                          <th className="py-3.5 px-4">Primary Capital Payer</th>
                          <th className="py-3.5 px-4 text-right">Payer Credit Value (INR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {financials?.rohan_itemized_audit_trail && Object.values(financials.rohan_itemized_audit_trail).flat().filter(item => item.type === 'CREDIT_DUE').length > 0 ? (
                          Object.entries(financials.rohan_itemized_audit_trail).flatMap(([name, items]) => 
                            items.filter(item => item.type === 'CREDIT_DUE').map((item, idx) => (
                              <tr key={`${name}-${idx}`} className="hover:bg-slate-50/70 transition-all">
                                <td className="py-3 px-4 font-mono text-slate-400">{item.date}</td>
                                <td className="py-3 px-4 font-bold text-slate-800">{item.description}</td>
                                <td className="py-3 px-4">
                                  <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                                    Paid By {name}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 text-sm">
                                  ₹{formatCurrency(item.amount)}
                                </td>
                              </tr>
                            ))
                          )
                        ) : (
                          <tr>
                            <td colSpan="4" className="py-12 text-center text-slate-400 bg-slate-50 font-medium">
                              No core primary outlays found. Use data importer channel.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DYNAMIC VIEW LAYER 4: DETAILED OPTIMIZED SETTLEMENT STRATEGY */}
              {dashboardView === 'settlements' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">Debt Minimization Strategy</h2>
                    <p className="text-xs text-slate-500">Aisha's smart settlement matrix simplifies global transaction pools into minimal steps.</p>
                  </div>

                  {financials?.aisha_simplified_settlements && financials.aisha_simplified_settlements.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {financials.aisha_simplified_settlements.map((tx, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-slate-300 transition-all">
                          <div className="flex justify-between items-center border-b border-slate-200/60 pb-2 mb-3">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Settlement Route #{idx + 1}</span>
                            <span className="text-[9px] bg-teal-50 text-teal-700 font-bold border border-teal-200 px-1.5 py-0.2 rounded">Optimal</span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-medium">Payer Member</span>
                              <span className="text-rose-500 font-black bg-rose-50 px-2 py-0.5 rounded border border-rose-100">{tx.from}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-medium">Recipient Member</span>
                              <span className="text-emerald-600 font-black bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{tx.to}</span>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900 font-mono">₹{formatCurrency(tx.amount)}</span>
                            <button className="bg-[#1cc29f] hover:bg-[#159a7e] text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all shadow-sm">
                              Resolve Transfer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-emerald-50/50 border border-dashed border-emerald-200 rounded-xl text-slate-600 text-xs font-bold">
                      ✨ Workspace balances match perfectly. Zero debt vectors remain active.
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* TAB 2: ROHAN'S ITEMIZED AUDIT VIEW PANEL */}
          {!loading && activeTab === 'audit' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Audit Ledger Tracking Console</h3>
                  <p className="text-xs text-slate-500">Select a group participant below to query their full individual trace histories.</p>
                </div>

                <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100 rounded-xl border border-slate-200/60">
                  {["Aisha", "Rohan", "Priya", "Meera", "Sam", "Dev"].map(u => (
                    <button 
                      key={u} 
                      onClick={() => setSelectedAuditUser(u)}
                      className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${selectedAuditUser === u ? 'bg-white text-[#1cc29f] shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transaction Table Layout */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {financials?.rohan_itemized_audit_trail && financials.rohan_itemized_audit_trail[selectedAuditUser]?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                          <th className="py-4 px-6">Effective Date</th>
                          <th className="py-4 px-6">Line Description</th>
                          <th className="py-4 px-6">Allocation Mapping</th>
                          <th className="py-4 px-6 text-right">Impact Delta (INR)</th>
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
                    No individual trace histories mapped inside this node block for {selectedAuditUser}.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MEERA'S PIPELINE EXPORT INGESTION PANEL */}
          {!loading && activeTab === 'import' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center max-w-2xl mx-auto space-y-4">
                <div className="w-14 h-14 bg-slate-50 text-[#1cc29f] rounded-full border border-slate-200 flex items-center justify-center text-xl mx-auto shadow-inner">
                  📁
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Ingestion Processing Engine</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                    Upload structured operational spreadsheet layouts to pass records into the live application cache.
                  </p>
                </div>
                
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 bg-slate-50 hover:bg-slate-100/60 transition-all cursor-pointer relative max-w-md mx-auto">
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleCsvFileUpload} 
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <span className="text-xs font-bold text-slate-400">Choose file target path (.csv)</span>
                </div>
              </div>

              {/* Seed System Config Panel */}
              <div className="p-5 border border-slate-200 rounded-2xl bg-white max-w-2xl mx-auto shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Database Schema Settings</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Initialize base relational tables across storage nodes.</p>
                </div>
                <button 
                  onClick={handleInitializeGroup}
                  className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl transition-all ${initStatus === "success" ? "bg-emerald-600 text-white cursor-default" : "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"}`}
                  disabled={initStatus === "loading" || initStatus === "success"}
                >
                  {initStatus === "loading" && "Building Schema..."}
                  {initStatus === "success" && "Schema Initialized"}
                  {initStatus !== "loading" && initStatus !== "success" && "Seed Database Mapping"}
                </button>
              </div>

              {/* DATA STAGING REPORT INTERACTION MATRIX */}
              {stagedData?.records && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-slideUp">
                  <div className="bg-slate-950 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-white border-b border-slate-800 space-y-3 sm:space-y-0">
                    <div>
                      <h4 className="text-xs font-black tracking-widest text-[#1cc29f] uppercase">Sandbox Records Staging Matrix</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Confirm structural validity indices before transactional lock.</p>
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
