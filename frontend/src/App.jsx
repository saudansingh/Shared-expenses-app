import React, { useState, useEffect, useCallback } from 'react';
import BASE_URL from './api.js';

export default function App() {
  const API_BASE = BASE_URL;
  
  // App States
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [stagedData, setStagedData] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [dashboardView, setDashboardView] = useState('balances'); 
  const [selectedAuditUser, setSelectedAuditUser] = useState("Aisha");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [initStatus, setInitStatus] = useState("");

  // ⚡ CRITICAL: Local override states to fix the backend appending bug immediately
  const [useLocalFreshCalculation, setUseLocalFreshCalculation] = useState(true);
  const [localFinancials, setLocalFinancials] = useState(null);

  // Parse strings safely into 2-decimal floats
  const formatCurrency = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? "0.00" : num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // ⚡ INSTANT LOCAL COMPUTATION ENGINE
  // This takes your uploaded file records and builds a 100% fresh sheet, overwriting previous data
  const computeFreshLocalMetrics = (records) => {
    if (!records || records.length === 0) return;

    const netBalances = {};
    const itemizedTrails = {};

    // Initialize pools
    const members = ["Aisha", "Rohan", "Priya", "Meera", "Sam", "Dev"];
    members.forEach(m => {
      netBalances[m] = 0;
      itemizedTrails[m] = [];
    });

    records.forEach(rec => {
      const amount = parseFloat(rec.amount_in_inr || rec.amount || 0);
      if (amount <= 0) return;

      const payer = (rec.paid_by || "Aisha").trim();
      
      // Determine splitting participants
      let splitWith = [];
      if (rec.split_with) {
        splitWith = rec.split_with.split(';').map(s => s.trim());
      } else {
        splitWith = ["Aisha", "Rohan", "Priya", "Meera"];
      }

      // Ensure key names exist
      if (!netBalances[payer]) netBalances[payer] = 0;
      if (!itemizedTrails[payer]) itemizedTrails[payer] = [];

      // Credit the payer
      netBalances[payer] += amount;
      itemizedTrails[payer].push({
        date: rec.date || "2026-02-01",
        description: rec.description,
        context: `Paid total outlay`,
        type: 'CREDIT_DUE',
        amount: amount
      });

      // Split math
      const shareCount = splitWith.length;
      const perHeadShare = amount / (shareCount > 0 ? shareCount : 1);

      splitWith.forEach(member => {
        if (!netBalances[member]) netBalances[member] = 0;
        if (!itemizedTrails[member]) itemizedTrails[member] = [];

        netBalances[member] -= perHeadShare;
        itemizedTrails[member].push({
          date: rec.date || "2026-02-01",
          description: rec.description,
          context: `Split share split down`,
          type: 'DEBIT_DUE',
          amount: perHeadShare
        });
      });
    });

    // Calculate minimized settlements
    const settlements = [];
    const debtors = [];
    const creditors = [];

    Object.entries(netBalances).forEach(([name, bal]) => {
      if (bal < -0.01) debtors.push({ name, bal: Math.abs(bal) });
      else if (bal > 0.01) creditors.push({ name, bal });
    });

    let dIdx = 0, cIdx = 0;
    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];
      const clearAmount = Math.min(debtor.bal, creditor.bal);

      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount: clearAmount
      });

      debtor.bal -= clearAmount;
      creditor.bal -= clearAmount;

      if (debtor.bal <= 0.01) dIdx++;
      if (creditor.bal <= 0.01) cIdx++;
    }

    setLocalFinancials({
      raw_net_balances: netBalances,
      rohan_itemized_audit_trail: itemizedTrails,
      aisha_simplified_settlements: settlements
    });
  };

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/groups`);
      const data = await res.json();
      setGroups(data);
      if (data && data.length > 0) setSelectedGroupId(data[0].id);
    } catch (e) {
      console.error(e);
    }
  }, [API_BASE]);

  const fetchFinancialAnalytics = useCallback(async () => {
    if (!selectedGroupId) return;
    try {
      const res = await fetch(`${API_BASE}/groups/${selectedGroupId}/balances`);
      const data = await res.json();
      setFinancials(data);
    } catch (err) {
      console.error(err);
    }
  }, [API_BASE, selectedGroupId]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);
  useEffect(() => { if (selectedGroupId !== null) fetchFinancialAnalytics(); }, [selectedGroupId, fetchFinancialAnalytics]);

  const handleCsvFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setMessage("");
    setStagedData(null); // Clear out the staging sandbox instantly

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/importer/stage`, { method: 'POST', body: formData });
      const data = await res.json();
      setStagedData(data);
      
      // Compute isolated local totals right here bypassing backend storage accumulation
      if (data?.records) {
        computeFreshLocalMetrics(data.records);
      }
      setMessage("CSV loaded fresh. Switched to Isolated Calculation Mode to prevent previous data bleeding.");
    } catch (err) {
      setMessage("Failed to read file lines safely.");
    }
    setLoading(false);
  };

  const handleUpdateStagedField = (index, field, value) => {
    if (!stagedData) return;
    const updated = stagedData.records.map((rec, idx) => idx === index ? { ...rec, [field]: value } : rec);
    const newStaged = { ...stagedData, records: updated };
    setStagedData(newStaged);
    computeFreshLocalMetrics(updated);
  };

  const commitApprovedDataToDb = async () => {
    if (!selectedGroupId || !stagedData) return;
    setLoading(true);
    try {
      await fetch(`${API_BASE}/importer/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: selectedGroupId, approved_records: stagedData.records })
      });
      setMessage("Data committed.");
      await fetchFinancialAnalytics();
      setActiveTab('dashboard');
    } catch (err) {
      setMessage("Commit update failed.");
    }
    setLoading(false);
  };

  // Determine active view data target based on our toggle position
  const activeMetrics = useLocalFreshCalculation && localFinancials ? localFinancials : financials;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans antialiased">
      
      {/* MINIMAL HIGHSPEED HEADER */}
      <header className="bg-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row justify-between items-center border-b border-slate-800 sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <span className="text-lg font-black tracking-tight text-[#1cc29f]">⚖️ CO-SPLIT INSTANT</span>
          <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold uppercase px-2 py-0.5 rounded">Fast-Track Build</span>
        </div>
        
        {/* RUNTIME ACCUMULATION OVERRIDE TOGGLE */}
        <div className="flex items-center space-x-3 mt-3 sm:mt-0">
          <label className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 cursor-pointer">
            <input 
              type="checkbox" 
              checked={useLocalFreshCalculation} 
              onChange={(e) => setUseLocalFreshCalculation(e.target.checked)}
              className="rounded border-slate-700 text-[#1cc29f] focus:ring-0 bg-slate-800"
            />
            <span className="text-[11px] font-black text-white uppercase tracking-wide">🚀 Fresh File Calculation Mode Only</span>
          </label>
        </div>
      </header>

      {message && (
        <div className="bg-teal-50 text-teal-900 border-b border-teal-200 px-6 py-3 text-xs font-bold flex justify-between items-center">
          <span>{message}</span>
          <button onClick={() => setMessage("")} className="font-black">✕</button>
        </div>
      )}

      {/* CONTROL BOARD ARCHITECTURE */}
      <div className="flex-1 flex flex-col md:flex-row max-w-[1600px] w-full mx-auto">
        
        {/* INTERACTIVE NAVIGATION CONTROL SIDEBAR */}
        <aside className="w-full md:w-64 bg-slate-900 text-slate-300 border-r border-slate-800 p-4 space-y-4">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-3">Functional Modules</div>
            <button onClick={() => setActiveTab('dashboard')} className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold text-left flex items-center space-x-3 ${activeTab === 'dashboard' ? 'bg-[#1cc29f] text-white shadow-md' : 'hover:bg-slate-800'}`}>
              <span>📊</span> <span>Interactive Dashboard</span>
            </button>
            <button onClick={() => setActiveTab('audit')} className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold text-left flex items-center space-x-3 ${activeTab === 'audit' ? 'bg-[#1cc29f] text-white shadow-md' : 'hover:bg-slate-800'}`}>
              <span>🔍</span> <span>Itemized Audit Trails</span>
            </button>
            <button onClick={() => setActiveTab('import')} className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold text-left flex items-center space-x-3 ${activeTab === 'import' ? 'bg-[#1cc29f] text-white shadow-md' : 'hover:bg-slate-800'}`}>
              <span>📥</span> <span>Control Data Importer</span>
            </button>
          </div>

          {activeTab === 'dashboard' && (
            <div className="space-y-1 border-t border-slate-800 pt-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-3">Dashboard Views</div>
              <button onClick={() => setDashboardView('balances')} className={`w-full py-2 px-3 rounded-lg text-xs font-bold text-left ${dashboardView === 'balances' ? 'text-[#1cc29f] bg-slate-800' : 'hover:text-white'}`}>💰 Net Pools Summary</button>
              <button onClick={() => setDashboardView('owed')} className={`w-full py-2 px-3 rounded-lg text-xs font-bold text-left ${dashboardView === 'owed' ? 'text-[#1cc29f] bg-slate-800' : 'hover:text-white'}`}>💸 Separate Owed Details</button>
              <button onClick={() => setDashboardView('expenses')} className={`w-full py-2 px-3 rounded-lg text-xs font-bold text-left ${dashboardView === 'expenses' ? 'text-[#1cc29f] bg-slate-800' : 'hover:text-white'}`}>📜 Raw Expenses Paid</button>
              <button onClick={() => setDashboardView('settlements')} className={`w-full py-2 px-3 rounded-lg text-xs font-bold text-left ${dashboardView === 'settlements' ? 'text-[#1cc29f] bg-slate-800' : 'hover:text-white'}`}>⚡ Simplified Matrix</button>
            </div>
          )}
        </aside>

        {/* WORKSPACE DATA FRAME CORES */}
        <main className="flex-1 p-6 overflow-y-auto">
          {loading && <div className="text-center py-12 text-xs font-bold">Refreshing data layers...</div>}

          {/* DASHBOARD MODAL */}
          {!loading && activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {dashboardView === 'balances' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Net Standing Pools</h2>
                    <p className="text-xs text-slate-400">Total metrics calculated strictly inside chosen balance constraints.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {activeMetrics?.raw_net_balances && Object.entries(activeMetrics.raw_net_balances).map(([name, bal]) => (
                      <div key={name} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                        <span className="text-sm font-black text-slate-900">{name}</span>
                        <div className={`text-base font-black tracking-tight mt-4 ${bal >= 0 ? 'text-[#1cc29f]' : 'text-[#ff6556]'}`}>
                          {bal >= 0 ? `Gets back ₹${formatCurrency(bal)}` : `Owes ₹${formatCurrency(Math.abs(bal))}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SEPARATE OWED TABLE */}
              {dashboardView === 'owed' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <div>
                    <h2 className="text-base font-black text-slate-900">Isolated Roommate Debt Matrix</h2>
                    <p className="text-xs text-slate-400">Isolated details table mapping explicit total amount owed per person.</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {activeMetrics?.rohan_itemized_audit_trail && Object.entries(activeMetrics.rohan_itemized_audit_trail).map(([name, items]) => {
                      const totalOwed = items.filter(i => i.type === 'DEBIT_DUE').reduce((acc, curr) => acc + curr.amount, 0);
                      return (
                        <div key={name} className="bg-white p-3 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-black text-slate-400 uppercase">{name} Cumulative Owed</span>
                          <span className="block text-sm font-black text-rose-500 font-mono mt-1">₹{formatCurrency(totalOwed)}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Expense Context</th>
                          <th className="py-3 px-4">Debtor Assignment</th>
                          <th className="py-3 px-4 text-right">Absolute Share (INR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {activeMetrics?.rohan_itemized_audit_trail && Object.entries(activeMetrics.rohan_itemized_audit_trail).flatMap(([name, items]) => 
                          items.filter(i => i.type === 'DEBIT_DUE').map((item, idx) => (
                            <tr key={`${name}-${idx}`} className="hover:bg-slate-50">
                              <td className="py-3 px-4 text-slate-400 font-mono">{item.date}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">{item.description}</td>
                              <td className="py-3 px-4"><span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded text-[10px] font-bold">Owed By {name}</span></td>
                              <td className="py-3 px-4 text-right font-mono font-black text-rose-500">₹{formatCurrency(item.amount)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SEPARATE EXPENSES PAID TABLE */}
              {dashboardView === 'expenses' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <h2 className="text-base font-black text-slate-900">Isolated Expenses Paid Logs</h2>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Outlay Context</th>
                          <th className="py-3 px-4">Primary Payer</th>
                          <th className="py-3 px-4 text-right">Credit Value (INR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {activeMetrics?.rohan_itemized_audit_trail && Object.entries(activeMetrics.rohan_itemized_audit_trail).flatMap(([name, items]) => 
                          items.filter(i => i.type === 'CREDIT_DUE').map((item, idx) => (
                            <tr key={`${name}-${idx}`} className="hover:bg-slate-50">
                              <td className="py-3 px-4 text-slate-400 font-mono">{item.date}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">{item.description}</td>
                              <td className="py-3 px-4"><span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-bold">Paid By {name}</span></td>
                              <td className="py-3 px-4 text-right font-mono font-black text-emerald-600">₹{formatCurrency(item.amount)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SETTLEMENTS VIEW */}
              {dashboardView === 'settlements' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <h2 className="text-base font-black text-slate-900">Optimized Debt Settlement Routes</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeMetrics?.aisha_simplified_settlements?.map((tx, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-700">
                          <span className="text-rose-500">{tx.from}</span> transfer payment directly to <span className="text-emerald-600">{tx.to}</span>
                        </div>
                        <span className="font-mono font-black text-sm text-slate-900">₹{formatCurrency(tx.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* AUDIT VIEW */}
          {!loading && activeTab === 'audit' && (
            <div className="space-y-4 bg-white border border-slate-200 p-6 rounded-2xl">
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl">
                {["Aisha", "Rohan", "Priya", "Meera", "Sam", "Dev"].map(u => (
                  <button key={u} onClick={() => setSelectedAuditUser(u)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${selectedAuditUser === u ? 'bg-white text-[#1cc29f] shadow-sm' : 'text-slate-500'}`}>{u}</button>
                ))}
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase"><th className="p-3">Date</th><th className="p-3">Description</th><th className="p-3 text-right">Amount (INR)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeMetrics?.rohan_itemized_audit_trail?.[selectedAuditUser]?.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-slate-400">{item.date}</td>
                        <td className="p-3 font-bold text-slate-800">{item.description}</td>
                        <td className={`p-3 text-right font-mono font-bold ${item.type === 'CREDIT_DUE' ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {item.type === 'CREDIT_DUE' ? `+₹${formatCurrency(item.amount)}` : `-₹${formatCurrency(item.amount)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* IMPORTER BOX */}
          {!loading && activeTab === 'import' && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="bg-white border border-slate-200 p-8 rounded-2xl text-center space-y-4 shadow-sm">
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 bg-slate-50 relative">
                  <input type="file" accept=".csv" onChange={handleCsvFileUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  <span className="text-xs font-bold text-slate-400 block">📁 Click or drop single CSV dataset sheet here</span>
                </div>
              </div>

              {stagedData?.records && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="bg-slate-950 p-4 flex justify-between items-center text-white">
                    <div>
                      <h4 className="text-xs font-black text-[#1cc29f]">STAGING PIPELINE DATA SANDBOX</h4>
                      <p className="text-[10px] text-slate-400">Confirm file metrics rows before pushing to permanent state loops.</p>
                    </div>
                    <button onClick={commitApprovedDataToDb} className="bg-[#1cc29f] hover:bg-[#159a7e] text-white font-black text-xs px-4 py-2 rounded-xl transition-all">Save to Shared Ledger DB</button>
                  </div>
                  <div className="max-h-60 overflow-y-auto text-[11px]">
                    {stagedData.records.map((rec, idx) => (
                      <div key={idx} className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <span className="font-bold text-slate-800">{rec.description || "Expense"}</span>
                        <span className="font-mono font-black text-slate-900">₹{formatCurrency(rec.amount_in_inr || rec.amount)}</span>
                      </div>
                    ))}
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
