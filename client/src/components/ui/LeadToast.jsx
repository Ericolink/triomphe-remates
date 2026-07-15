import { Bell } from 'lucide-react';

export default function LeadToast({ t, diff, lead }) {
  return (
    <div
      className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } bg-white shadow-lg rounded-xl p-4 flex items-start gap-3 max-w-sm border border-gray-100`}
    >
      <div className="w-10 h-10 bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
        <Bell size={18} className="text-yellow-400" />
      </div>
      <div>
        <p className="font-semibold text-gray-800 text-sm">
          {diff === 1 ? 'Nuevo lead recibido' : `${diff} nuevos leads`}
        </p>
        {lead && (
          <p className="text-gray-500 text-xs mt-0.5">
            {lead.name} — {lead.type}
          </p>
        )}
      </div>
    </div>
  );
}