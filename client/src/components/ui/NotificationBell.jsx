import { useState } from 'react';
import { Bell, X, User, Building2, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useNotifications from '../../hooks/useNotifications';

const typeLabel = {
  contacto: 'Solicitud de info',
  cita: 'Agendar visita',
  informacion: 'Información',
};
const typeColor = {
  contacto: 'bg-blue-100 text-blue-700',
  cita: 'bg-yellow-100 text-yellow-700',
  informacion: 'bg-purple-100 text-purple-700',
};

export default function NotificationBell() {
  const { unreadCount, notifications, clearNotifications } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleOpen = () => {
    setOpen(!open);
    if (!open) clearNotifications();
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
        title="Notificaciones"
      >
        <Bell size={20} className="text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-20 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-blue-900" />
                <span className="font-semibold text-gray-800 text-sm">Leads nuevos</span>
                {unreadCount > 0 && (
                  <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            {/* Lista */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <Bell size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin leads nuevos</p>
                </div>
              ) : (
                notifications.map((lead) => (
                  <div
                    key={lead.id}
                    className="px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 cursor-pointer"
                    onClick={() => {
                      navigate('/admin/crm?tab=prospectos');
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-blue-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-gray-800 text-sm truncate">{lead.name}</p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${typeColor[lead.type]}`}
                          >
                            {typeLabel[lead.type]}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{lead.email}</p>
                        {lead.property && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-1 truncate">
                            <Building2 size={10} /> {lead.property?.title}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                          <Calendar size={10} /> {formatDate(lead.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100">
              <button
                onClick={() => {
                  navigate('/admin/crm?tab=prospectos');
                  setOpen(false);
                }}
                className="w-full text-center text-sm text-blue-700 font-medium hover:text-blue-900 transition-colors"
              >
                Ver todos los leads →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
