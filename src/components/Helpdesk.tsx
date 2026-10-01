import React, { useState } from 'react';
import { Ticket, TicketStatus, User } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatDateShort, formatTime } from '../utils/bookingUtils';
import { ShieldCheck, Plus, UserCheck, CheckCircle2, Clock, AlertTriangle, Wrench, RotateCcw, Mail } from 'lucide-react';

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

const PRIORITY_ORDER: Record<Ticket['priority'], number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

type AssigneeFilter = 'all' | 'mine' | 'unassigned';

// IT/admin-only queue -- this component is only ever mounted for
// isITStaff/admin users (see App.tsx), so it doesn't need to guard its own
// content by role the way the old shared component did. Deliberately
// distinct from MyTickets.tsx (the employee-facing page): triage tools
// (priority sort, assignee filter) that a single "my requests" list has no
// use for, and every ticket's requester contact info surfaced up front
// since IT needs to reach out, not just read their own submission back.
export const Helpdesk: React.FC<HelpdeskProps> = ({ tickets, currentUser, onNewTicket, onUpdateTicket }) => {
  const { t, language } = useLanguage();
  const [activeStatus, setActiveStatus] = useState<TicketStatus>('Open');
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const statusFiltered = tickets.filter((tk) => tk.status === activeStatus);
  const assigneeFiltered = statusFiltered.filter((tk) => {
    if (assigneeFilter === 'mine') return tk.assignedToEmail?.toLowerCase() === currentUser.email.toLowerCase();
    if (assigneeFilter === 'unassigned') return !tk.assignedToEmail;
    return true;
  });
  // Triage order: most urgent first, then oldest-first (FIFO) within the same priority.
  const displayedTickets = [...assigneeFiltered].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

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

  const handleReopen = (ticket: Ticket) => {
    // Clear the prior resolution cycle's leftovers too -- otherwise a
    // reopened ticket still displays the old (now-stale) resolution notes
    // and assignee as if the reopened issue were already handled.
    onUpdateTicket(ticket.id, {
      status: 'Open',
      resolutionNotes: '',
      resolvedAt: '',
      assignedToEmail: '',
      resolvedByEmail: '',
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header -- deliberately queue/triage-flavored, not a simple list like MyTickets.tsx */}
      <div className="bg-[#0c2417] rounded-3xl p-6 sm:p-8 border border-emerald-900/20 shadow-sm space-y-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/15 text-emerald-300 rounded-2xl border border-emerald-400/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold">{t('helpdeskTitle')}</h1>
              <p className="text-xs text-emerald-200/60">{t('helpdeskSubtitle')}</p>
            </div>
          </div>

          <button
            onClick={onNewTicket}
            className="py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-[#0c2417] font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>{t('newTicketBtn')}</span>
          </button>
        </div>

        {/* Status Sub-Tabs */}
        <div className="flex items-center space-x-2 border-b border-white/10 pt-2 text-xs overflow-x-auto">
          {STATUS_TABS.map((status) => {
            const count = tickets.filter((tk) => tk.status === status).length;
            const isActive = activeStatus === status;
            return (
              <button
                key={status}
                onClick={() => setActiveStatus(status)}
                className={`px-4 py-2.5 font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  isActive ? 'border-emerald-400 text-white' : 'border-transparent text-emerald-200/50 hover:text-white'
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

        {/* Assignee quick filter -- triage tool, has no equivalent on the employee-facing page */}
        <div className="flex items-center gap-2 text-[11px]">
          {(['all', 'mine', 'unassigned'] as AssigneeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setAssigneeFilter(f)}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                assigneeFilter === f
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/5 text-emerald-200/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              {t(`ticketFilter${f === 'all' ? 'All' : f === 'mine' ? 'Mine' : 'Unassigned'}` as any)}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket List */}
      {displayedTickets.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm space-y-3">
          <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto" />
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
                <a
                  href={`mailto:${tk.requesterEmail}`}
                  className="flex items-center gap-1 text-blue-700 hover:underline"
                >
                  <Mail className="w-3.5 h-3.5" /> {tk.requesterEmail}
                </a>
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

              {/* Triage controls */}
              {(tk.status === 'Open' || tk.status === 'InProgress') && (
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

              {/* IT can also reopen a ticket themselves (e.g. closed by mistake), not just wait for the requester to */}
              {(tk.status === 'Resolved' || tk.status === 'Closed') && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleReopen(tk)}
                    className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
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
