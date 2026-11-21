/**
 * English UI dictionary — defines the MessageKey set (RU primary, EN second).
 * Copy source: docs/DESIGN.md §4.7 (owner-approved) — RU strings there are
 * verbatim; page tasks may add keys but ALWAYS to both dictionaries
 * (parity is CI-enforced, see tests/i18n.test.ts).
 */
export const en = {
  /* --- shell / navigation (DESIGN §1.2, §4.7, §4.14.2) --- */
  'nav.room': 'Around',
  'nav.people': 'People',
  'nav.contacts': 'Contacts',
  'nav.contacts.dot_aria': 'new contacts',
  'nav.chats': 'Chats',
  'nav.chats.dot_aria': 'new chats',
  'nav.profile': 'Profile',
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
  'join.create_persona': 'Create profile',
  'join.change_code': 'Change code',
  'join.form.name': 'Name',
  'join.form.public_bio': 'What others see',
  'join.form.private_bio': 'For your agent only',
  // §4.14.3 creation-form contact input (Concept §14.1.3): local-only
  // contact card — stored on the device after creation, shared only on
  // the share slide (never sent at creation).
  'join.form.contact': 'Your contact',
  // §24 item 10: the device-storage footer note removed from the chat
  // (the old `join.form.contact_hint` key is deleted from BOTH
  // dictionaries — RU/EN parity kept).
  // §4.16.2 creation wizard (Concept §22.3 item 2): the chat-style
  // auto-chat interview copy — the mascot asks every question in a bubble.
  'join.wizard.agent.name': 'Bleak',
  'join.wizard.log': 'Profile interview',
  'join.wizard.intro.title': "Hi! I'm Bleak.",
  // §24 item 6: calm and friendly — the agent explains its role (the
  // necessary context) and prepares the user for a simple dialog.
  'join.wizard.intro.line':
    "I'm your agent — I'll introduce you to the room and talk to other attendees for you. We'll go through a few short questions, no rush — skip anything optional.",
  'join.wizard.intro.start': 'Start',
  'join.wizard.name.question': 'What shall we call you?',
  'join.wizard.name.answer': 'Nice to meet you, {name}!',
  'join.wizard.public.question': 'A few words about you — other attendees will see this.',
  'join.wizard.private.question': 'Now something private — for your agent only.',
  'join.wizard.contact.question': 'Want to leave a contact? Pick which kind.',
  'join.wizard.contact.skip': 'Skip',
  'join.wizard.contact.phone': 'Phone',
  'join.wizard.contact.email': 'Email',
  // §23.2 5.4: instead of a "Messenger" kind — a nickname field with the
  // suggested prefixes (tg:@ / signal:@ / inst:@), appendable.
  'join.wizard.contact.nickname': 'Nickname',
  'join.wizard.contact.enter': 'Enter your {kind}.',
  'join.wizard.interests.question': 'What are you into? Pick a theme.',
  'join.wizard.interests.pick_question': 'What do you like in {group}? Pick as many as you like.',
  // §23.2 5.7: a finished theme returns to the theme badges until "Ready".
  'join.wizard.interests.done': 'Done with theme',
  'join.wizard.interests.skip': 'Skip',
  'join.wizard.themes.ready': 'Ready',
  // §23.2 5.1: send happens on Enter or the button right of the input
  // (iOS Messages style); each input carries a current/max counter.
  'join.wizard.send': 'Send',
  'join.wizard.counter': '{n}/{max}',
  // §24 item 8: the quick-clear "x" in the input pill.
  'join.wizard.clear': 'Clear',
  // §23.2 5.3: a placeholder example for every input case.
  'join.wizard.placeholder.name': 'e.g. Ann',
  'join.wizard.placeholder.public': 'I am a backend dev',
  'join.wizard.placeholder.private': 'Looking for a hackathon team',
  'join.wizard.placeholder.contact_value': '+1 555 010 1234',
  'join.wizard.placeholder.contact_nick': 'e.g. durov',
  'join.wizard.creating': 'Creating your profile…',
  'join.error.name_taken': 'That name is already taken in the room.',
  'join.error.gone': 'This event is no longer available.',
  'join.error.name_required': 'Enter your name.',
  // Return-to-event screen (Concept §10.1.1, DESIGN §4.11.1 — amends §4.7):
  // picking a saved persona enters its room with the stored token —
  // identity restore, no re-creation.
  'join.import.title': 'Return to event',
  'join.import.subtitle': 'Profiles created on this phone.',
  'join.import.return': 'Return',
  'join.import.empty': 'No saved profiles on this device yet.',
  'join.import.saved_at': 'Saved {date}',
  'join.import.row_aria': 'Return to profile {name}',
  'join.import.dead':
    'This profile no longer exists on the server. The entry stays listed, but you cannot return to it.',
  'join.error.invite': 'The invite code is invalid or expired.',
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
  'scan.code_used': 'Code already used — ask them to refresh their badge QR.',
  'scan.own_qr': "That's your own QR — show it to someone else.",
  'scan.foreign_persona': 'This profile is from another event.',
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
  'room.scan.open': 'Scan a profile QR',
  'room.empty': 'Nobody here yet. Ask the host for the invite code — or share yours.',
  'room.members_more': '+{n} more',
  'room.node.chat': '{name} — your agents are already talking',
  'room.node.incoming': '{name} — added you',
  'room.node.outgoing': '{name} — handshake sent',
  'room.node.none': '{name} — handshake not sent yet',

  /* --- handshake states (DESIGN §3.2/§3.3, §4.7) --- */
  'hs.send': 'Send handshake',
  'hs.sent': 'Handshake sent',
  'hs.waiting': 'Handshake sent — waiting for theirs',
  'hs.back': 'Handshake back',
  'hs.added_you': 'Added you',
  'hs.chatting': 'Chatting',
  'hs.agents_talking': 'Your agents are already talking',
  'hs.open_dialog': 'Open dialog',
  'hs.income_limit': 'Outgoing handshake limit reached — receive handshakes first.',
  'hs.error.network': 'Connection lost. Check the Wi-Fi.',

  /* --- people (DESIGN §3.3, §4.7; reworked §4.15.4.3) --- */
  'people.title': 'People',
  'people.subtitle': 'Everyone in the room.',
  'people.empty': 'The room is empty so far.',
  'people.search.placeholder': 'Search by name or bio…',
  'people.empty_search': 'Nobody matches “{q}”',
  'people.reset': 'Reset',
  'people.search.label': 'Search people',
  'people.action.send': 'Send handshake to {name}',
  'people.dismiss': 'Dismiss',
  // §4.15.4.3 (Concept §19.3): "handshake back" → "handshake!" — the
  // handshake-back button copy; the "chatting" badge is replaced by the
  // "Open chat" button (navigates the way the removed icon did).
  'people.action.back': 'handshake!',
  'people.action.open_chat': 'Open chat',

  /* --- chats (DESIGN §3.4/§3.5, §4.7) --- */
  'chats.title': 'Chats',
  'chats.subtitle': 'Where your agents talk',
  'chats.empty': "No dialogs yet. A mutual handshake starts the agents' conversation.",
  'chats.find_people': 'Find people',
  // §4.11.5–7 (Concept §10.1.5–7): the theme words left the list item; the
  // accessible name now carries the dialog's STATUS (the right-side icon).
  'chats.card.aria': 'Dialog with {name} · {status}',
  'chats.status.active': 'active',
  'chats.status.finished': 'finished',
  'chat.warming_up': 'The agents are warming up…',
  // §8.1.9: kickoff left the attendee dialog view; the confirm copy stays
  // (host drill-down kickoff uses it — MemberDrillDown).
  'chat.kickoff.confirm_title': 'Start the conversation over?',
  'chat.kickoff.confirm_body':
    'The dialog history will be cleared and the agents will start over. The sender of the earliest handshake speaks first.',
  'chat.kickoff.confirm_run': 'Restart',
  'chat.contact_stub': 'Share contact — coming later',
  // §4.13.3 contact share (Concept §13.1.3): the dialog footer's slide
  // control + the local contact-card field + the received list.
  'chat.contact_share.label': 'Swipe right to share your contact',
  'chat.contact_share.shared': 'Contact already shared',
  // §4.15.C-8/§4.15.E (Concept §15.3): the SHEET-variant slide's copy —
  // "Slide to share contact" + the completion text; the 409 "already
  // shared" label above stays unchanged (reused unchanged).
  'chat.contact_share.sheet_label': 'Slide to share contact',
  'chat.contact_share.shared_done': 'Contact shared!',
  'chat.contact_share.locked': 'Available once the dialog is finished',
  'chat.contact_share.no_card': 'Add your contact card in profile settings',
  'chat.contact_share.error': 'Could not share the contact — try again.',
  // §4.13.5 summary sheet (Concept §13.1.5): the finished-chat sheet heading,
  // its checklist heading and the donut's accessible name. The checkpoint
  // LABELS are server-provided English — displayed verbatim, never i18n'd.
  'chat.summary.title': 'Meeting summary',
  'chat.summary.checklist': 'Networking checklist',
  'chat.summary.score.aria': 'Match: {score} out of 100',
  'chat.summary.loading': 'Summarizing the dialog…',
  // §4.15.B/E (Concept §15.2): the footer summarization button — enabled
  // ("Meeting summary") it opens the summary sheet on demand; disabled it
  // carries the "dialog in progress" phrase.
  'chat.summary.open': 'Meeting summary',
  'chat.summary.open.disabled': 'Dialog in progress',
  // §4.15.C-5/C-6 (Concept §15.3): the match-tier labels (80/50 thresholds
  // per the owner revision, 2026-11-20); the chat.summary.me caption key is
  // removed — v3.7 owner amendment, the name captions under the avatars are
  // gone (2026-11-20).
  'chat.summary.tier.great': 'Great match',
  'chat.summary.tier.good': 'Good chat',
  'chat.summary.tier.low': 'Different vibes',
  'profile.contact.edit': 'Contact card',
  'profile.contact.label': 'Your contact card',
  'profile.contact.note':
    'For example: telegram: @handle. Only people you share it with see it.',
  // §4.14.2 contacts footer page (Concept §14.1.2): the /contacts tab is the
  // PRIMARY "shared with you" surface — the §4.13.3 settings-side list is
  // superseded (its keys retired with the list).
  'contacts.title': 'Contacts',
  'contacts.subtitle': 'Contacts shared with you',
  'contacts.empty': 'Nobody has shared a contact with you yet.',
  'chat.not_found': 'Dialog not found — it may have been deleted.',
  'chat.back_to_list': 'Back to dialogs',
  'chat.scroll_bottom': 'Jump to latest',
  'chat.new_message': 'New message from {name}',
  'chat.host_view': 'Host view',

  /* --- profile (DESIGN §3.6, §4.7) --- */
  'profile.title': 'Profile',
  'profile.subtitle': 'Your profile in this room.',
  'profile.language.meta': 'Agent language: {language}',
  'profile.greeting.caption': "Opens each of your agent's new dialogs",
  'profile.greeting.rule':
    'The greeting opens every new dialog. No questions — statements only.',
  'profile.greeting.no_questions':
    'Remove the question marks — the greeting must not contain questions.',
  'profile.greeting.label': 'Greeting',
  'profile.greeting.counter': '{n}/255',
  'profile.greeting.edit': 'Greeting',
  'profile.greeting.regenerate': 'Regenerate',
  'profile.persona.edit': 'Profile',
  'profile.badge.about': 'About',
  'profile.badge.for_agent': 'For your agent',
  'profile.private_bio.caption': 'only your agent sees this',
  'profile.interests.title': 'Interests',
  // §23.2 5.6: interests are set AT CREATION ONLY (the wizard's themes) —
  // the settings editor is removed; the mirror stays for the badge.
  'profile.interests.empty': 'No interests yet',

  // §23.2 5.5 THEMES model (interest group → theme; the slugs live in the
  // title string `theme:topic_key`, the numeric group/key pair stays the
  // server contract; keys referenced by the catalog module).
  'interests.group.0': 'Music',
  'interests.group.1': 'Sport',
  'interests.group.2': 'Food & drinks',
  'interests.group.3': 'Art',
  'interests.group.4': 'Computers',
  'interests.group.5': 'Science',
  'interests.group.6': 'Architecture',
  'interests.group.7': 'Travel',
  // 0 — music
  'interests.k1': 'Classical',
  'interests.k2': 'Rock',
  'interests.k3': 'Jazz',
  'interests.k4': 'Rap',
  'interests.k5': 'Electronic',
  'interests.k6': 'Indie',
  // 1 — sport
  'interests.k7': 'Ice hockey',
  'interests.k8': 'Running',
  'interests.k9': 'Football',
  'interests.k10': 'Yoga',
  'interests.k11': 'Hiking',
  'interests.k12': 'Cycling',
  // 2 — food & drinks
  'interests.k13': 'Coffee',
  'interests.k14': 'Tea',
  'interests.k15': 'Cooking',
  'interests.k16': 'Wine',
  'interests.k17': 'Desserts',
  'interests.k18': 'Street food',
  // 3 — art
  'interests.k19': 'Painting',
  'interests.k20': 'Photography',
  'interests.k21': 'Cinema',
  'interests.k22': 'Books',
  'interests.k23': 'Theatre',
  'interests.k24': 'Design',
  // 4 — computers
  'interests.k25': 'Programming',
  'interests.k26': 'AI',
  'interests.k27': 'Games',
  'interests.k28': 'Gadgets',
  'interests.k29': 'Open source',
  'interests.k30': 'Hardware',
  // 5 — science
  'interests.k31': 'Physics',
  'interests.k32': 'Biology',
  'interests.k33': 'Space',
  'interests.k34': 'Math',
  'interests.k35': 'Chemistry',
  'interests.k36': 'Robotics',
  // 6 — architecture
  'interests.k37': 'Modernism',
  'interests.k38': 'Gothic',
  'interests.k39': 'Urbanism',
  'interests.k40': 'Interiors',
  'interests.k41': 'Bridges',
  'interests.k42': 'Monuments',
  // 7 — travel
  'interests.k43': 'Backpacking',
  'interests.k44': 'Road trips',
  'interests.k45': 'Camping',
  'interests.k46': 'Sea',
  'interests.k47': 'Cities',
  'interests.k48': 'Mountains',
  // §8.1.5: exactly three stats — Sent (ex "Handshakes"), Added you,
  // Chatting (ex "Dialogs").
  'profile.stats.handshakes_label': 'Sent',
  'profile.stats.dialogs_label': 'Chatting',
  'profile.stats.added_label': 'Added you',
  'profile.stats.handshakes': 'Sent {n}',
  'profile.stats.dialogs': 'Chatting {n}',
  'profile.qr.caption': 'Show this to trade handshakes',
  'profile.qr.alt': 'Personal QR code',
  'profile.qr.onetime': 'The QR is one-time — it refreshes itself after a handshake.',
  'profile.qr.refreshed': 'QR refreshed',
  'profile.qr.aria': 'Your one-time handshake QR',
  'profile.saved': 'Saved',
  'profile.settings.title': 'My profile',
  'profile.settings.persona': 'My profile',
  'profile.leave': 'Leave the room',
  'profile.leave.confirm_body':
    'You will leave the event. Your token stays on this device — you can return any time via Return to event.',
  'profile.not_found': 'Profile not found',
  'profile.exit': 'Leave',
  'profile.rotate.row': 'Regenerate access token',
  'profile.rotate.title': 'Regenerate the access token?',
  'profile.rotate.body':
    'The current credential will stop working: other devices holding it will lose access to this profile.',
  'profile.rotate.cta': 'Regenerate',
  'profile.rotate.done': 'Credential updated',

  /* --- host (DESIGN §3.7, §4.7) --- */
  'host.title': 'Host',
  'host.subtitle': 'Create an event room and share the invite.',
  // v2 credentials (DESIGN rev. 3 §3.7): one-time creation-token gate — the
  // renamed host.gate.* keys; host.token.* remnants stay until TZ2-11 drops them.
  'host.gate.label': 'Room creation token',
  'host.gate.continue': 'Continue',
  'host.gate.note':
    'A one-time token issued by the deployment operator. After the room is created it is never needed again and is not stored.',
  'host.session_reset': 'Room access was revoked — sign in again with a creation token.',
  'host.token.rejected': 'Token rejected.',
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
  'host.code.label': 'Invite code',
  'host.code.aria': 'Code: {code}',
  'host.qr.alt': 'Invite QR code',
  'host.invite_link': 'Invite link',
  'host.settings.title': 'Room settings',
  'host.danger.title': 'Danger zone',
  'host.stats.members_only': 'Members',
  'host.stats.language_only': 'Language',
  'host.member.open': '{name} — open card',
  // v2 invite management + room-token drill-down (DESIGN rev. 3 §3.7, §4.7)
  'host.invites.title': 'Invite codes',
  'host.invites.hint': 'A code works until it expires; you can revoke it any time.',
  'host.invites.mint': 'Mint a code',
  'host.invites.preset.1h': '1 hour',
  'host.invites.preset.24h': '24 hours',
  'host.invites.preset.7d': '7 days',
  'host.invites.preset.custom': 'Custom…',
  'host.invites.custom_label': 'Code expires',
  'host.invites.expires_in': 'expires in {time}',
  'host.invites.revoke': 'Revoke',
  'host.invites.revoke_aria': 'Revoke code {code}',
  'host.invites.qr_toggle': 'QR for code {code}',
  'host.invites.revoked': 'Code revoked.',
  'host.rotate_room.row': 'Regenerate room token',
  'host.rotate_room.title': 'Regenerate the room credential?',
  'host.rotate_room.body': 'The current room credential will stop working. Continue?',
  'host.rotate_room.cta': 'Regenerate',
  'host.rotate_room.done': 'Room credential updated',
  'host.drill.clear': 'Clear history',
  'host.drill.clear_confirm': "The participants' dialog history will be cleared.",
  'host.drill.empty': 'This member has no dialogs yet.',
  'host.drill.pending_amendment':
    "The member's dialog list arrives with the server-side amendment (flag 6.9a).",
  'host.drill.kickoff': 'Restart',
  'host.drill.dialogs': 'Dialogs',

  /* --- global 401 gate (DESIGN rev. 3 §2.8, §4.7) --- */
  'auth.401.notice':
    'This profile has no valid access credential — join again with the event code.',

  /* --- common (DESIGN §2.1, §4.7) --- */
  'common.loading': 'Loading…',
  'common.locale': 'Interface language',
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
