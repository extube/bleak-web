/**
 * English UI dictionary — defines the MessageKey set (RU primary, EN second).
 * Copy source: docs/DESIGN.md §4.7 (owner-approved) — RU strings there are
 * verbatim; page tasks may add keys but ALWAYS to both dictionaries
 * (parity is CI-enforced, see tests/i18n.test.ts).
 */
export const en = {
  /* --- shell / navigation (DESIGN §1.2, §4.7) --- */
  'app.title': 'bleak-web',
  'nav.room': 'Around',
  'nav.people': 'People',
  'nav.chats': 'Chats',
  'nav.profile': 'Profile',
  'nav.host': 'Host',
  'nav.aria': 'Main navigation',

  /* --- join (DESIGN §3.1, §4.7) --- */
  'join.title': 'Join the event',
  'join.subtitle': 'Enter the 6-digit invite code from the QR or the invitation.',
  'join.code.label': 'Invite code',
  'join.code.placeholder': '000000',
  'join.code.digit': 'digit {n}',
  'join.enter': 'Enter the room',
  'join.error.unknown': 'Code not found — check with the host.',
  'join.code.malformed': 'The code must be 6 digits.',
  'join.scan.open': 'Or scan a QR code',
  'join.room.language': 'Agent language: {language}',
  'join.room.members': 'Members: {n}',
  'join.create_persona': 'Create persona',
  'join.import': 'Import from a previous event',
  'join.import.notice': 'The persona will be copied into this event',
  'join.change_code': 'Change code',
  'join.form.name': 'Name',
  'join.form.public_bio': 'What others see',
  'join.form.private_bio': 'For your agent only',
  'join.error.name_taken': 'That name is already taken in the room.',
  'join.error.gone': 'This event is no longer available.',
  'join.resume.title': 'Continue to {room}',
  'join.resume.another': 'Join another event',

  /* --- camera scanner (DESIGN §3.8, §4.7) --- */
  'scan.title': 'Scan QR code',
  'scan.close': 'Close scanner',
  'scan.hint.join': 'Point the camera at the invite QR',
  'scan.hint.person': "Point the camera at the QR on an attendee's badge",
  'scan.permission.intro': 'The camera needs your permission to scan.',
  'scan.turn_on': 'Turn on camera',
  'scan.permission.denied':
    'Camera access is denied. Allow it in the browser settings — or enter the code manually.',
  'scan.try_again': 'Try again',
  'scan.no_camera': 'No camera available on this device.',
  'scan.insecure': 'Open the site over HTTPS to enable the camera.',
  'scan.fallback.enter_code': 'Enter code manually',
  'scan.fallback.find_list': 'Find in the list',
  'scan.again': 'Scan again',
  'scan.invalid_qr': 'This is not a bleak-web QR code.',
  'scan.own_qr': "That's your own QR — show it to someone else.",
  'scan.foreign_persona': 'This persona is from another event.',
  'scan.confirm.title': 'Send mutual handshakes and start the agents?',
  'scan.confirm.cta': 'Trade handshakes',
  'scan.confirm.cancel': 'Cancel',
  'scan.error.network': 'Connection lost. Check the Wi-Fi.',
  'scan.aria': 'QR scanner',
  'scan.placeholder': 'The scanner arrives in a later build task.',

  /* --- room radar (DESIGN §3.2, §4.7) --- */
  'room.title': 'Around me',
  'room.subtitle': 'Attendees near you in this room.',
  'room.around': '{n} around you',
  'room.scan.open': 'Scan a persona QR',
  'room.empty': 'Nobody here yet. Ask the host for the invite code — or share yours.',
  'room.members_more': '+{n} more',

  /* --- handshake states (DESIGN §3.2/§3.3, §4.7) --- */
  'hs.send': 'Send handshake',
  'hs.sent': 'Handshake sent',
  'hs.waiting': 'Handshake sent — waiting for theirs',
  'hs.back': 'Handshake back',
  'hs.added_you': 'Added you',
  'hs.chatting': 'Chatting',
  'hs.agents_talking': 'Your agents are already talking',
  'hs.open_dialog': 'Open dialog',
  'hs.error.network': 'Connection lost. Check the Wi-Fi.',

  /* --- people (DESIGN §3.3, §4.7) --- */
  'people.title': 'People',
  'people.subtitle': 'Everyone in the room.',
  'people.empty': 'The room is empty so far.',
  'people.search.placeholder': 'Search by name or bio…',
  'people.filter.all': 'All',
  'people.filter.sent': 'Sent',
  'people.filter.added': 'Added you',
  'people.filter.chatting': 'Chatting',
  'people.empty_search': 'Nobody matches “{q}”',
  'people.reset': 'Reset',

  /* --- chats (DESIGN §3.4/§3.5, §4.7) --- */
  'chats.title': 'Chats',
  'chats.subtitle': 'Where your agents talk',
  'chats.empty': "No dialogs yet. A mutual handshake starts the agents' conversation.",
  'chats.find_people': 'Find people',
  'chat.warming_up': 'The agents are warming up…',
  'chat.kickoff': 'Restart the dialog',
  'chat.kickoff.confirm_title': 'Start the conversation over?',
  'chat.kickoff.confirm_body':
    'The dialog history will be cleared and the agents will start over. The sender of the earliest handshake speaks first.',
  'chat.kickoff.confirm_run': 'Restart',
  'chat.kickoff.speaker': '{name} speaks first',
  'chat.contact_stub': 'Share contact — coming later',
  'chat.not_found': 'Dialog not found — it may have been deleted.',

  /* --- profile (DESIGN §3.6, §4.7) --- */
  'profile.title': 'Profile',
  'profile.subtitle': 'Your persona-agent in this room.',
  'profile.language.meta': 'Agent language: {language}',
  'profile.greeting.caption': "Opens each of your agent's new dialogs",
  'profile.greeting.rule':
    'The greeting opens every new dialog. No questions — statements only.',
  'profile.greeting.no_questions':
    'Remove the question marks — the greeting must not contain questions.',
  'profile.badge.about': 'About',
  'profile.badge.for_agent': 'For your agent',
  'profile.private_bio.caption': 'only your agent sees this',
  'profile.interests.empty': 'No interests yet',
  'profile.stats.handshakes': 'Handshakes {n}',
  'profile.stats.dialogs': 'Dialogs {n}',
  'profile.qr.caption': 'Show this to trade handshakes',
  'profile.leave': 'Leave the room',
  'profile.leave.confirm_body':
    'Your persona will be removed from the room along with its handshakes and dialogs.',
  'profile.not_found': 'Persona not found',
  'profile.exit': 'Leave',

  /* --- host (DESIGN §3.7, §4.7) --- */
  'host.title': 'Host',
  'host.subtitle': 'Create an event room and share the invite.',
  'host.token.label': 'Host token',
  'host.token.rejected': 'Token rejected.',
  'host.token.forget': 'Forget token',
  'host.token.note': 'The token is issued by the deployment owner.',
  'host.token.continue': 'Continue',
  'host.form.name': 'Name',
  'host.form.description': 'Description',
  'host.form.language': 'Agent language',
  'host.create': 'Create room',
  'host.join_attendee': 'Join as attendee',
  'host.create_another': 'Create another room',
  'host.stats.members': 'Members {n}/{max}',
  'host.stats.language': 'Language {language}',
  'host.empty_live': 'Nobody has joined yet.',
  'host.delete_room': 'Delete room',
  'host.delete_warning': 'The room will be deleted with all its members.',
  'host.room_deleted': 'The room was deleted.',

  /* --- common (DESIGN §2.1, §4.7) --- */
  'common.loading': 'Loading…',
  'common.error': 'Something went wrong.',
  'common.error.network': 'Connection lost. Check the Wi-Fi — we keep retrying.',
  'common.error.api': 'Server error',
  'common.retry': 'Retry',
  'common.back': 'Back',
  'common.close': 'Close',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.copy': 'Copy',
  'common.copied': 'Copied'
} as const;

export type MessageKey = keyof typeof en;
