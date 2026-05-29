import React from "react";

export default function StatCard({ label, value, color, icon }) {
  return (
    <div className="bg-white border border-[#e1e3e4] rounded-2xl p-5 flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}
      >
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-[#191c1d]">{value ?? "—"}</div>
        <div className="text-xs text-[#555f6d] font-medium">{label}</div>
      </div>
    </div>
  );
}
