import { Calendar, Building2, ListOrdered, LayoutDashboard, LifeBuoy } from 'lucide-react';
import type { ComponentType } from 'react';

export type TabKey = 'rooms' | 'schedule' | 'my-bookings' | 'helpdesk' | 'admin';

// Rollout flag: IT Helpdesk is built and deployed but not yet announced to
// staff. 'admin-only' limits the tab to admins for internal testing (e.g.
// setting the first isITStaff flags); 'everyone' reveals it to all staff --
// no other code change needed to flip this. (Requested 2026-08-25.)
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
