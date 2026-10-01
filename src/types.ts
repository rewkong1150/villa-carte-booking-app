export type RoomId = 'room-101' | 'room-102' | 'room-103' | 'room-201' | 'room-202';

export interface Room {
  id: RoomId;
  floor: 1 | 2;
  name: string;
  nameEn: string;
  capacity: number;
  description: string;
  amenities: string[];
  imageUrl: string;
  color: string; // Theme accent color
  /** Google Workspace Calendar Resource email (sales-office Layanverde building) --
   * inviting this as an event attendee with resource:true is what makes a
   * booking made through this app actually show as busy on the room's real
   * Google Calendar resource, visible/conflict-checked from Google Calendar
   * directly too, not just inside this app. Optional: a room without one
   * still books normally in-app, just without that Google-side reflection. */
  resourceEmail?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  avatar: string;
  role: 'user' | 'admin';
  isITStaff?: boolean;
}

export interface Booking {
  id: string;
  roomId: RoomId;
  title: string;
  description?: string;
  userId: string;
  userName: string;
  userEmail: string;
  department: string;
  startTime: string; // ISO String
  endTime: string;   // ISO String
  attendeesCount: number;
  guestEmails?: string[];
  googleCalendarEventId?: string;
  googleCalendarEventLink?: string;
  /** Booker opted in to have IT staff set up/attend the meeting -- triggers
   * an email to IT staff (server-side, see pb_hooks/notifyItSetup.pb.js) and
   * a separate Google Calendar invite to them (client-side, see App.tsx). */
  needsItSupport?: boolean;
  /** Event id of the separate IT-setup Google Calendar invite (see
   * googleCalendarService.ts createItSetupCalendarEvent) -- tracked so
   * cancelling the booking can also delete this event, same as
   * googleCalendarEventId does for the main event. */
  itSetupCalendarEventId?: string;
  status: 'confirmed' | 'cancelled';
  createdAt: string; // ISO String
  updatedAt?: string;
}

export interface EmailNotification {
  id: string;
  type: 'booking_created' | 'booking_cancelled' | 'booking_updated';
  recipientEmail: string;
  recipientName: string;
  subject: string;
  bodyHtml: string;
  sentAt: string;
  read: boolean;
  /** Set by the sendBookingEmail Cloud Function once it attempts real delivery (see functions/index.js) */
  emailSent?: boolean;
  emailSentAt?: string;
  emailError?: string;
  bookingDetails: {
    roomName: string;
    floor: number;
    title: string;
    startTime: string;
    endTime: string;
    userName: string;
  };
}

export type TicketCategory = 'Hardware' | 'Software' | 'Network' | 'Account' | 'Other';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TicketStatus = 'Open' | 'InProgress' | 'Resolved' | 'Closed';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  requesterEmail: string;
  requesterName: string;
  requesterDepartment: string;
  assignedToEmail?: string;
  resolvedByEmail?: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  createdAt: string; // ISO string
  updatedAt?: string;
}

export interface RoomStatus {
  roomId: RoomId;
  isOccupied: boolean;
  currentBooking?: Booking;
  nextBooking?: Booking;
}

export interface MonthlyStats {
  totalBookings: number;
  totalHours: number;
  topRoomName: string;
  cancellationRate: number;
  roomStats: {
    roomId: RoomId;
    roomName: string;
    bookingCount: number;
    totalHours: number;
    utilizationPercent: number;
  }[];
  departmentStats: {
    department: string;
    bookingCount: number;
    totalHours: number;
  }[];
}
