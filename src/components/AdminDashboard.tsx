import React, { useState, useMemo, useEffect } from 'react';
import { Booking, Room, User } from '../types';
import { formatDateShort, formatTime, formatDurationHours, getRoomName, getRoomShortLabel } from '../utils/bookingUtils';
import { getDepartmentLabel } from '../data/departments';
import { exportBookingsToExcel, exportBookingsToPDF } from '../utils/exportUtils';
import { useLanguage } from '../context/LanguageContext';
import {
  BarChart, Bar, YAxis, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Search, Download, FileSpreadsheet, FileText, Trash2, Edit, ShieldCheck,
  Building2, Users, Calendar, TrendingUp, CheckCircle2, XCircle, ChevronLeft, ChevronRight
} from 'lucide-react';

interface AdminDashboardProps {
  bookings: Booking[];
  rooms: Room[];
  currentUser: User;
  onEditBooking: (booking: Booking) => void;
  onDeleteBooking: (bookingId: string) => void;
}

const PAGE_SIZE = 10;

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  bookings,
  rooms,
  onEditBooking,
  onDeleteBooking,
}) => {
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [roomFilter, setRoomFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [deleteConfirmBooking, setDeleteConfirmBooking] = useState<Booking | null>(null);

  // Filter bookings
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.department.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRoom = roomFilter === 'all' || b.roomId === roomFilter;
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;

    return matchesSearch && matchesRoom && matchesStatus;
  });

  useEffect(() => {
    setPage(1);
  }, [searchTerm, roomFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const pagedBookings = useMemo(
    () => filteredBookings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredBookings, page]
  );

  // Calculate Monthly Analytics Data
  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');
  const totalBookingsCount = bookings.length;
  const confirmedCount = confirmedBookings.length;
  const cancelledCount = bookings.filter((b) => b.status === 'cancelled').length;
  const cancellationRate = totalBookingsCount > 0 ? Math.round((cancelledCount / totalBookingsCount) * 100) : 0;

  const totalHoursBooked = confirmedBookings.reduce(
    (sum, b) => sum + formatDurationHours(b.startTime, b.endTime),
    0
  );

  // Bar Chart Data: Hours per Room
  const roomChartData = rooms.map((r) => {
    const roomBks = confirmedBookings.filter((b) => b.roomId === r.id);
    const hours = roomBks.reduce((sum, b) => sum + formatDurationHours(b.startTime, b.endTime), 0);
    return {
      name: getRoomShortLabel(r),
      fullName: getRoomName(r, language),
      hours: Math.round(hours * 10) / 10,
      count: roomBks.length,
    };
  });

  // Pie Chart Data: Department Usage Distribution
  const departmentCounts: Record<string, number> = {};
  confirmedBookings.forEach((b) => {
    departmentCounts[b.department] = (departmentCounts[b.department] || 0) + 1;
  });

  const departmentPieData = Object.keys(departmentCounts).map((dept) => ({
    name: getDepartmentLabel(dept, language),
    value: departmentCounts[dept],
  }));

  const PIE_COLORS = ['#1b4332', '#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'];

  const handleExportExcel = () => {
    exportBookingsToExcel(filteredBookings, rooms, `VillaCarte_Meeting_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    exportBookingsToPDF(filteredBookings, rooms, `VillaCarte_Meeting_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Top Admin Banner */}
      <div className="bg-gradient-to-r from-[#0c2417] via-[#143d2a] to-[#1e5238] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-[#1b4b33]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-full flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" /> {t('adminBackOfficeBadge')}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {t('adminDashboardTitle')}
            </h1>
            <p className="text-emerald-100/80 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              {t('adminFullPrivilegesDesc')}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleExportExcel}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition min-h-[40px]"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{t('exportExcel')}</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition min-h-[40px]"
            >
              <FileText className="w-4 h-4" />
              <span>{t('exportPdf')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Key Performance Indicator Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-900/10 shadow-sm flex items-center space-x-3 sm:space-x-4">
          <div className="p-2.5 sm:p-3 bg-emerald-50 text-[#1b4332] rounded-2xl border border-emerald-100 shrink-0">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900">{totalBookingsCount}</div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-semibold truncate">{t('totalBookingsStat')}</div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-900/10 shadow-sm flex items-center space-x-3 sm:space-x-4">
          <div className="p-2.5 sm:p-3 bg-emerald-50 text-[#1b4332] rounded-2xl border border-emerald-100 shrink-0">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900">{Math.round(totalHoursBooked)} {t('hoursUnit')}</div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-semibold truncate">{t('totalHoursStat')}</div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-900/10 shadow-sm flex items-center space-x-3 sm:space-x-4">
          <div className="p-2.5 sm:p-3 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100 shrink-0">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900">{t('confirmedCountLabel', { count: confirmedCount })}</div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-semibold truncate">{t('statusConfirmedPill')}</div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-900/10 shadow-sm flex items-center space-x-3 sm:space-x-4">
          <div className="p-2.5 sm:p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 shrink-0">
            <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900">{cancellationRate}%</div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-semibold truncate">{t('cancellationRateWithCount', { count: cancelledCount })}</div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hours Booked per Room */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-emerald-900/10 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#1b4332] shrink-0" />
            {t('hoursPerRoomChartTitle')}
          </h3>
          <div className="h-52 sm:h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roomChartData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <RechartsTooltip />
                <Bar dataKey="hours" name={t('hoursSeriesName')} fill="#1b4332" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Usage Distribution */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-emerald-900/10 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-[#1b4332] shrink-0" />
            {t('deptUsageChartTitle')}
          </h3>
          <div className="h-52 sm:h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={departmentPieData}
                  cx="50%"
                  cy="50%"
                  outerRadius="70%"
                  dataKey="value"
                  label={({ name, percent }) => `${name.split(' ')[0]} (${(percent * 100).toFixed(0)}%)`}
                >
                  {departmentPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* All Bookings Table Section */}
      <div className="bg-white rounded-3xl border border-emerald-900/10 shadow-sm overflow-hidden space-y-4 p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-emerald-950 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#1b4332] shrink-0" />
              {t('masterLogsTitle')}
            </h3>
            <p className="text-xs text-slate-500">{t('masterLogsDesc')}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-[#1b4332] font-extrabold text-xs rounded-xl border border-emerald-200 transition flex items-center gap-1.5 min-h-[36px]"
            >
              <Download className="w-4 h-4 text-[#1b4332]" /> {t('exportExcel')}
            </button>
            <button
              onClick={handleExportPDF}
              className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-800 font-extrabold text-xs rounded-xl border border-rose-200 transition flex items-center gap-1.5 min-h-[36px]"
            >
              <Download className="w-4 h-4 text-rose-600" /> {t('exportPdf')}
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={t('searchPlaceholderAdmin')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[40px]"
            />
          </div>

          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white font-medium min-h-[40px]"
          >
            <option value="all">{t('allRoomsFilterOption')}</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {getRoomName(r, language)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white font-medium min-h-[40px]"
          >
            <option value="all">{t('allStatusFilterOption')}</option>
            <option value="confirmed">{t('confirmedFilterOption')}</option>
            <option value="cancelled">{t('cancelledFilterOption')}</option>
          </select>
        </div>

        {pagedBookings.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic text-sm border border-emerald-900/10 rounded-2xl">
            {t('noResultsFound')}
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden space-y-3">
              {pagedBookings.map((bk) => {
                const room = rooms.find((r) => r.id === bk.roomId);
                const start = new Date(bk.startTime);
                const end = new Date(bk.endTime);
                return (
                  <div key={bk.id} className="p-4 border border-emerald-900/10 rounded-2xl space-y-2 bg-slate-50/60">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">{bk.title}</div>
                        <div className="text-[11px] text-slate-500">{room ? getRoomName(room, language) : bk.roomId} · {t('floorShort', { floor: room?.floor })}</div>
                      </div>
                      {bk.status === 'confirmed' ? (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full inline-flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3" /> {t('statusConfirmedPill')}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-rose-100 text-rose-800 font-bold text-[10px] rounded-full inline-flex items-center gap-1 shrink-0">
                          <XCircle className="w-3 h-3" /> {t('statusCancelledPill')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-700">
                      <div className="font-semibold">{bk.userName}</div>
                      <div className="text-[11px] text-slate-400">{bk.userEmail}</div>
                      <div className="text-[11px] text-indigo-600 font-medium">{getDepartmentLabel(bk.department, language)}</div>
                    </div>
                    <div className="text-xs font-mono">
                      <div className="font-bold text-slate-800">{formatDateShort(start, language)}</div>
                      <div className="text-slate-500">{formatTime(start, language)} - {formatTime(end, language)}</div>
                    </div>
                    <div className="flex items-center justify-end gap-1 pt-1">
                      <button
                        onClick={() => onEditBooking(bk)}
                        className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title={t('editActionTitle')}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmBooking(bk)}
                        className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title={t('deleteActionTitle')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop/tablet: table */}
            <div className="hidden md:block overflow-x-auto border border-emerald-900/10 rounded-2xl shadow-xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-[#0c2417] text-white font-extrabold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5">{t('roomColumn')}</th>
                    <th className="p-3.5">{t('meetingTitle')}</th>
                    <th className="p-3.5">{t('bookerName')}</th>
                    <th className="p-3.5">{t('dateColumn')}</th>
                    <th className="p-3.5">{t('statusColumn')}</th>
                    <th className="p-3.5 text-right">{t('actionColumn')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {pagedBookings.map((bk) => {
                    const room = rooms.find((r) => r.id === bk.roomId);
                    const start = new Date(bk.startTime);
                    const end = new Date(bk.endTime);

                    return (
                      <tr key={bk.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                          <div>{room ? getRoomName(room, language) : bk.roomId}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{t('floorShort', { floor: room?.floor })}</div>
                        </td>

                        <td className="p-3.5 max-w-xs">
                          <div className="font-bold text-slate-900 truncate">{bk.title}</div>
                          {bk.description && (
                            <div className="text-[10px] text-slate-500 truncate">{bk.description}</div>
                          )}
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">{bk.userName}</div>
                          <div className="text-[10px] text-slate-400">{bk.userEmail}</div>
                          <div className="text-[10px] text-indigo-600 font-medium">{getDepartmentLabel(bk.department, language)}</div>
                        </td>

                        <td className="p-3.5 whitespace-nowrap font-mono">
                          <div className="font-bold text-slate-800">{formatDateShort(start, language)}</div>
                          <div className="text-[11px] text-slate-500">
                            {formatTime(start, language)} - {formatTime(end, language)}
                          </div>
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          {bk.status === 'confirmed' ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> {t('statusConfirmedPill')}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold text-[10px] rounded-full inline-flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> {t('statusCancelledPill')}
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => onEditBooking(bk)}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title={t('editActionTitle')}
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setDeleteConfirmBooking(bk)}
                              className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title={t('deleteActionTitle')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-500">
                  {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredBookings.length)} / {filteredBookings.length} {t('itemsUnit')}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-700 px-2">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog for Admin */}
      {deleteConfirmBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">{t('deleteConfirmTitle')}</h3>
              <p className="text-xs text-slate-500">
                {t('deleteConfirmDesc', { title: deleteConfirmBooking.title, name: deleteConfirmBooking.userName })}
              </p>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {t('deleteConfirmNotice')}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmBooking(null)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition min-h-[44px]"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  onDeleteBooking(deleteConfirmBooking.id);
                  setDeleteConfirmBooking(null);
                }}
                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shadow-md shadow-rose-500/20 min-h-[44px]"
              >
                {t('deleteConfirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
