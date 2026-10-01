import { Calendar, Building2, ListOrdered, LayoutDashboard, LifeBuoy } from 'lucide-react';
import type { ComponentType } from 'react';

export type TabKey = 'rooms' | 'schedule' | 'my-bookings' | 'helpdesk' | 'admin';

// Rollout flag: IT Helpdesk was built 2026-08-25, briefly opened to
// 'everyone' 2026-09-26, then pulled back to 'admin-only' 2026-09-29 pending
// a full bug audit of the booking/calendar-sync/helpdesk changes made this
// week -- not a rollback of any specific found bug, just caution before a
// wider audience sees it again.
export const HELPDESK_VISIBILITY: 'admin-only' | 'everyone' = 'admin-only';

export interface NavItem {
  key: TabKey;
  icon: ComponentType<{ className?: string }>;
  sidebarLabelKey: 'monthlySchedule' | 'floorOverview' | 'myReservations' | 'helpdeskNav' | 'adminReports';
  mobileLabelKey: 'mobileNavSchedule' | 'mobileNavRooms' | 'mobileNavMyBookings' | 'mobileNavHelpdesk' | 'mobileNavAdmin';
}

// Single source of truth for the main tabs, shared by Sidebar (desktop) and
// the mobile tab bar in App.tsx so labels/icons/order never drift between them.
export const NAV_ITEMS: NavItem[] = [
  { key: 'schedule', icon: Calendar, sidebarLabelKey: 'monthlySchedule', mobileLabelKey: 'mobileNavSchedule' },
  { key: 'rooms', icon: Building2, sidebarLabelKey: 'floorOverview', mobileLabelKey: 'mobileNavRooms' },
  { key: 'my-bookings', icon: ListOrdered, sidebarLabelKey: 'myReservations', mobileLabelKey: 'mobileNavMyBookings' },
  { key: 'helpdesk', icon: LifeBuoy, sidebarLabelKey: 'helpdeskNav', mobileLabelKey: 'mobileNavHelpdesk' },
  { key: 'admin', icon: LayoutDashboard, sidebarLabelKey: 'adminReports', mobileLabelKey: 'mobileNavAdmin' },
];
