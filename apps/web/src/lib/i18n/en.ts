/** English UI dictionary (RU primary, EN second — parity is test-enforced). */
export const en = {
  'app.title': 'bleak-web',
  'nav.room': 'Room',
  'nav.people': 'People',
  'nav.chats': 'Chats',
  'nav.profile': 'Profile',
  'nav.host': 'Host',
  'join.title': 'Join the event',
  'join.subtitle': 'Enter the 6-digit invite code from the QR or the invitation.',
  'join.code.label': 'Invite code',
  'join.code.placeholder': '000000',
  'join.enter': 'Enter room',
  'join.error.unknown': 'Unknown code — check it with the host.',
  'room.title': 'Around me',
  'room.subtitle': 'Attendees near you in this room.',
  'room.empty': 'No one around yet.',
  'people.title': 'People',
  'people.subtitle': 'Everyone in the room.',
  'people.empty': 'The room is empty so far.',
  'chats.title': 'Chats',
  'chats.subtitle': 'Dialogs of your mutual handshakes — the agents talk here.',
  'chats.empty': 'No dialogs yet. Send a handshake first.',
  'profile.title': 'Profile',
  'profile.subtitle': 'Your persona-agent in this room.',
  'host.title': 'Host',
  'host.subtitle': 'Create an event room and share the invite.',
  'common.loading': 'Loading…',
  'common.error': 'Something went wrong.',
  'common.retry': 'Retry'
} as const;

export type MessageKey = keyof typeof en;
