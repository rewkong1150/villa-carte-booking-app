import { RecordModel } from 'pocketbase';
import { pb } from '../pocketbase/config';
import { Ticket } from '../types';

const TICKETS_COLLECTION = 'itTickets';

const toTicket = (record: RecordModel): Ticket => ({
  id: record.id,
  title: record.title,
  description: record.description,
  category: record.category,
  priority: record.priority,
  status: record.status,
  requesterEmail: record.requesterEmail,
  requesterName: record.requesterName,
  requesterDepartment: record.requesterDepartment || '',
  assignedToEmail: record.assignedToEmail || undefined,
  resolvedByEmail: record.resolvedByEmail || undefined,
  resolutionNotes: record.resolutionNotes || undefined,
  resolvedAt: record.resolvedAt || undefined,
  createdAt: record.created,
  updatedAt: record.updated !== record.created ? record.updated : undefined,
});

export const subscribeTickets = (onUpdate: (tickets: Ticket[]) => void): (() => void) => {
  let currentList: Ticket[] = [];
  let disposed = false;
  let unsubscribeFn: (() => void) | null = null;

  const emit = () => {
    if (!disposed) onUpdate([...currentList]);
  };

  const init = async () => {
    try {
      // Rule-filtered server-side: regular users only ever get their own tickets back,
      // IT staff / admin get all of them -- same list call works for both roles.
      const records = await pb.collection(TICKETS_COLLECTION).getFullList({ sort: '-created' });

      if (disposed) return;
      currentList = records.map(toTicket);
      emit();

      unsubscribeFn = await pb.collection(TICKETS_COLLECTION).subscribe('*', (e) => {
        if (e.action === 'create') {
          currentList = [toTicket(e.record), ...currentList.filter((t) => t.id !== e.record.id)];
        } else if (e.action === 'update') {
          currentList = currentList.map((t) => (t.id === e.record.id ? toTicket(e.record) : t));
        } else if (e.action === 'delete') {
          currentList = currentList.filter((t) => t.id !== e.record.id);
        }
        emit();
      });

      if (disposed && unsubscribeFn) unsubscribeFn();
    } catch (err) {
      console.error('Error subscribing to itTickets in PocketBase:', err);
    }
  };

  init();

  return () => {
    disposed = true;
    if (unsubscribeFn) unsubscribeFn();
  };
};

export const addTicket = async (
  ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'status'>
): Promise<Ticket> => {
  const record = await pb.collection(TICKETS_COLLECTION).create({ ...ticket, status: 'Open' });
  return toTicket(record);
};

export const updateTicket = async (ticketId: string, updates: Partial<Ticket>): Promise<void> => {
  const { id, createdAt, updatedAt, ...cleanUpdates } = updates as Partial<Ticket> & {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  await pb.collection(TICKETS_COLLECTION).update(ticketId, cleanUpdates);
};
