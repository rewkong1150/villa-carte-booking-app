import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Booking, Room } from '../types';
import { formatThaiDateShort, formatThaiTime, formatDateShort, formatTime, formatDurationHours } from './bookingUtils';

export const exportBookingsToExcel = (bookings: Booking[], rooms: Room[], filename = 'VillaCarte_Meeting_Report.xlsx') => {
  // Sheet 1: Raw booking logs
  const bookingRows = bookings.map((b, idx) => {
    const room = rooms.find((r) => r.id === b.roomId);
    const start = new Date(b.startTime);
    const end = new Date(b.endTime);
    const hours = formatDurationHours(b.startTime, b.endTime);

    return {
      'ลำดับ (No.)': idx + 1,
      'รหัสการจอง (ID)': b.id,
      'ห้องประชุม (Room)': room ? room.name : b.roomId,
      'ชั้น (Floor)': room ? `ชั้น ${room.floor}` : '-',
      'หัวข้อการประชุม (Title)': b.title,
      'ผู้จอง (Booked By)': b.userName,
      'อีเมล (Email)': b.userEmail,
      'แผนก (Department)': b.department,
      'จำนวนผู้เข้าประชุม (Attendees)': b.attendeesCount,
      'วันที่ประชุม (Date)': formatThaiDateShort(start),
      'เวลาเริ่ม (Start Time)': formatThaiTime(start),
      'เวลาสิ้นสุด (End Time)': formatThaiTime(end),
      'ระยะเวลา (ชั่วโมง)': hours,
      'สถานะ (Status)': b.status === 'confirmed' ? 'อนุมัติ/ยืนยันแล้ว' : 'ยกเลิกแล้ว',
      'วันที่ทำรายการ (Created At)': formatThaiDateShort(new Date(b.createdAt)),
    };
  });

  const wsBookings = XLSX.utils.json_to_sheet(bookingRows);

  // Auto-width adjustment
  const colWidths = [
    { wch: 8 },  // No.
    { wch: 18 }, // ID
    { wch: 25 }, // Room
    { wch: 10 }, // Floor
    { wch: 35 }, // Title
    { wch: 20 }, // User
    { wch: 25 }, // Email
    { wch: 20 }, // Dept
    { wch: 12 }, // Attendees
    { wch: 15 }, // Date
    { wch: 12 }, // Start
    { wch: 12 }, // End
    { wch: 12 }, // Hours
    { wch: 15 }, // Status
    { wch: 15 }, // Created
  ];
  wsBookings['!cols'] = colWidths;

  // Sheet 2: Room Usage Summary
  const roomSummaryRows = rooms.map((r) => {
    const confirmedForRoom = bookings.filter((b) => b.roomId === r.id && b.status === 'confirmed');
    const totalHours = confirmedForRoom.reduce((sum, b) => sum + formatDurationHours(b.startTime, b.endTime), 0);
    return {
      'ห้องประชุม': r.name,
      'ชั้น': `ชั้น ${r.floor}`,
      'ความจุ (คน)': `${r.capacity} คน`,
      'จำนวนครั้งที่ถูกจอง': confirmedForRoom.length,
      'รวมชั่วโมงการใช้งาน': Math.round(totalHours * 10) / 10,
    };
  });
  const wsRoomSummary = XLSX.utils.json_to_sheet(roomSummaryRows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, wsBookings, 'รายการจองทั้งหมด');
  XLSX.utils.book_append_sheet(workbook, wsRoomSummary, 'สรุปตามห้องประชุม');

  XLSX.writeFile(workbook, filename);
};

export const exportBookingsToPDF = (bookings: Booking[], rooms: Room[], filename = 'VillaCarte_Meeting_Report.pdf') => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Title & Header
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text('Villa Carte Group - Meeting Room Booking Report', 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated Date: ${new Date().toLocaleString()} | Total Records: ${bookings.length}`, 14, 22);

  // Table Data Preparation
  const tableHead = [
    ['No.', 'Room', 'Title', 'Booked By', 'Dept.', 'Date', 'Time', 'Hours', 'Status']
  ];

  // NOTE: jsPDF's built-in fonts (Helvetica etc.) do not contain Thai glyphs, so any
  // Thai text here renders blank/garbled. Room name and date/time use the English/ASCII
  // formatters below to stay legible; user-entered fields (title, booker name) may still
  // contain Thai text — for a fully Thai-legible report, use the Excel export instead.
  const tableBody = bookings.map((b, idx) => {
    const room = rooms.find((r) => r.id === b.roomId);
    const start = new Date(b.startTime);
    const end = new Date(b.endTime);
    const hours = formatDurationHours(b.startTime, b.endTime);

    return [
      (idx + 1).toString(),
      room ? room.nameEn : b.roomId,
      b.title.length > 30 ? b.title.slice(0, 30) + '...' : b.title,
      b.userName,
      b.department,
      formatDateShort(start, 'en'),
      `${formatTime(start, 'en')} - ${formatTime(end, 'en')}`,
      `${hours} hrs`,
      b.status === 'confirmed' ? 'Confirmed' : 'Cancelled',
    ];
  });

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: 28,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(filename);
};
