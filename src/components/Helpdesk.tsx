import React, { useState } from 'react';
import { Ticket, TicketStatus, User } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatDateShort, formatTime } from '../utils/bookingUtils';
import { LifeBuoy, Plus, UserCheck, CheckCircle2, Clock, AlertTriangle, Wrench } from 'lucide-react';

interface HelpdeskProps {
  tickets: Ticket[];
  currentUser: User;
  onNewTicket: () => void;
  onUpdateTicket: (ticketId: string, updates: Partial<Ticket>) => void;
}

const STATUS_TABS: TicketStatus[] = ['Open', 'InProgress', 'Resolved', 'Closed'];

const STATUS_BADGE_STYLES: Record<TicketStatus, string> = {
  Open: 'bg-amber-100 text-amber-900',
  InProgress: 'bg-blue-100 text-blue-900',
  Resolved: 'bg-emerald-100 text-emerald-900',
  Closed: 'bg-slate-200 text-slate-700',
};

const PRIORITY_BADGE_STYLES: Record<Ticket['priority'], string> = {
  Low: 'bg-slate-100 text-slate-600',
  Medium: 'bg-sky-100 text-sky-800',
  High: 'bg-orange-100 text-orange-800',
  Urgent: 'bg-rose-100 text-rose-800',
};

export const Helpdesk: React.FC<HelpdeskProps> = ({ tickets, currentUser, onNewTicket, onUpdateTicket }) => {
  const { t, language } = useLanguage();
  const [activeStatus, setActiveStatus] = useState<TicketStatus>('Open');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const isITStaff = !!currentUser.isITStaff || currentUser.role === 'admin';

  const displayedTickets = tickets.filter((tk) => tk.status === activeStatus);

  const handleAssignToMe = (ticket: Ticket) => {
    onUpdateTicket(ticket.id, { assignedToEmail: currentUser.email, status: 'InProgress' });
  };

  const handleMarkStatus = (ticket: Ticket, status: TicketStatus) => {
    const notes = notesDraft[ticket.id];
    onUpdateTicket(ticket.id, {
      status,
      // "Mark Resolved"/"Mark Closed" can be clicked directly on an Open
      // ticket without ever using "Assign to Me" first, so assignedToEmail
      // alone doesn't reliably say who actually did the work -- record the
      // resolver separately, at the moment of resolving.
      ...(status === 'Resolved' || status === 'Closed'
        ? { resolvedAt: new Date().toISOString(), resolvedByEmail: currentUser.email }
        : {}),
      ...(notes && notes.trim() ? { resolutionNotes: notes.trim() } : {}),
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-900/10 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-50 text-blue-700 rounded-2xl border border-blue-200">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-emerald-950">{t('helpdeskTitle')}</h1>
              <p className="text-xs text-slate-500">{t('helpdeskSubtitle')}</p>
            </div>
          </div>

          <button
            onClick={onNewTicket}
            className="py-2.5 px-4 bg-[#1b4332] hover:bg-[#163a28] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>{t('newTicketBtn')}</span>
          </button>
        </div>

        {/* Status Sub-Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-100 pt-2 text-xs overflow-x-auto">
          {STATUS_TABS.map((status) => {
            const count = tickets.filter((tk) => tk.status === status).length;
            const isActive = activeStatus === status;
            return (
              <button
                key={status}
                onClick={() => setActiveStatus(status)}
                className={`px-4 py-2.5 font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  isActive ? 'border-[#1b4332] text-[#1b4332]' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>{t(`ticketStatus${status}` as any)}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${STATUS_BADGE_STYLES[status]}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ticket List */}
      {displayedTickets.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm space-y-3">
          <LifeBuoy className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">{t('noTicketsFound')}</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedTickets.map((tk) => (
            <div
              key={tk.id}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-0.5 font-extrabold text-[10px] rounded-full ${STATUS_BADGE_STYLES[tk.status]}`}>
                  {t(`ticketStatus${tk.status}` as any)}
                </span>
                <span className={`px-2 py-0.5 font-bold text-[10px] rounded-full ${PRIORITY_BADGE_STYLES[tk.priority]}`}>
                  {t(`ticketPriority${tk.priority}` as any)}
                </span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold text-[10px] rounded-full flex items-center gap-1">
                  <Wrench className="w-2.5 h-2.5" /> {t(`ticketCategory${tk.category}` as any)}
                </span>
              </div>

              <h3 className="text-base font-extrabold text-slate-900">{tk.title}</h3>
              <p className="text-xs text-slate-600 whitespace-pre-wrap">{tk.description}</p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-50">
                <span>
                  {t('ticketRequestedBy')}: <strong className="text-slate-700">{tk.requesterName}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDateShort(new Date(tk.createdAt), language)} {formatTime(new Date(tk.createdAt), language)}
                </span>
                {tk.assignedToEmail && (
                  <span className="flex items-center gap-1 text-blue-700">
                    <UserCheck className="w-3.5 h-3.5" /> {tk.assignedToEmail}
                  </span>
                )}
              </div>

              {(tk.resolutionNotes || tk.resolvedByEmail) && (
                <div className="text-xs text-emerald-900 bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-100 space-y-0.5">
                  {tk.resolvedByEmail && (
                    <div>
                      <span className="font-bold">{t('ticketResolvedByLabel')}:</span> {tk.resolvedByEmail}
                    </div>
                  )}
                  {tk.resolutionNotes && (
                    <div>
                      <span className="font-bold">{t('ticketResolutionNotesLabel')}:</span> {tk.resolutionNotes}
                    </div>
                  )}
                </div>
              )}

              {/* IT staff / admin controls */}
              {isITStaff && (tk.status === 'Open' || tk.status === 'InProgress') && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <textarea
                    value={notesDraft[tk.id] || ''}
                    onChange={(e) => setNotesDraft((prev) => ({ ...prev, [tk.id]: e.target.value }))}
                    placeholder={t('ticketResolutionNotesPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    {tk.status === 'Open' && (
                      <button
                        onClick={() => handleAssignToMe(tk)}
                        className="py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {t('ticketAssignToMeBtn')}
                      </button>
                    )}
                    <button
                      onClick={() => handleMarkStatus(tk, 'Resolved')}
                      className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t('ticketMarkResolvedBtn')}
                    </button>
                    <button
                      onClick={() => handleMarkStatus(tk, 'Closed')}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {t('ticketMarkClosedBtn')}
                    </button>
                  </div>
                </div>
              )}

              {/* Requester can reopen their own resolved/closed ticket */}
              {!isITStaff &&
                tk.requesterEmail.toLowerCase() === currentUser.email.toLowerCase() &&
                (tk.status === 'Resolved' || tk.status === 'Closed') && (
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      onClick={() =>
                        // Clear the prior resolution cycle's leftovers too -- otherwise a
                        // reopened ticket still displays the old (now-stale) resolution
                        // notes and assignee as if the reopened issue were already handled.
                        onUpdateTicket(tk.id, {
                          status: 'Open',
                          resolutionNotes: '',
                          resolvedAt: '',
                          assignedToEmail: '',
                          resolvedByEmail: '',
                        })
                      }
                      className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs rounded-xl transition"
                    >
                      {t('ticketReopenBtn')}
                    </button>
                  </div>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
