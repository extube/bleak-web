import type { MessageKey } from './en';

/**
 * Russian UI dictionary — primary UI language (Concept §2).
 * Copy source: docs/DESIGN.md §4.7 (owner-approved) — strings are verbatim;
 * keys must match en.ts exactly (parity is CI-enforced).
 */
export const ru: Record<MessageKey, string> = {
  /* --- shell / navigation (DESIGN §1.2, §4.7, §4.14.2) --- */
  'nav.room': 'Рядом',
  'nav.people': 'Люди',
  'nav.contacts': 'Контакты',
  'nav.contacts.dot_aria': 'есть новые контакты',
  'nav.chats': 'Диалоги',
  'nav.chats.dot_aria': 'есть новые диалоги',
  'nav.profile': 'Профиль',
  'nav.aria': 'Основная навигация',

  /* --- join --- */
  'join.title': 'Войти на событие',
  'join.subtitle': 'Введите 6-значный код приглашения с QR-кода или из приглашения.',
  'join.code.label': 'Код приглашения',
  'join.code.placeholder': '000000',
  'join.code.digit': 'цифра {n}',
  'join.enter': 'Войти в комнату',
  'join.error.unknown': 'Код не найден — уточните его у организатора.',
  'join.code.malformed': 'Код должен быть 6 цифр.',
  'join.scan.open': 'Или отсканировать QR-код',
  'join.room.language': 'Язык агентов: {language}',
  'join.room.members': 'Участников: {n}',
  'join.create_persona': 'Создать профиль',
  'join.change_code': 'Изменить код',
  'join.form.name': 'Имя',
  'join.form.public_bio': 'Кто вы — увидят другие',
  'join.form.private_bio': 'Только для вашего агента',
  // §4.14.3 поле контакта в форме создания (Concept §14.1.3): только
  // локально, отправится лишь при жесте «поделиться».
  'join.form.contact': 'Ваш контакт',
  'join.form.contact_hint': 'Хранится только на этом устройстве. Отправится, когда вы поделитесь.',
  'join.error.name_taken': 'Такое имя в комнате уже занято.',
  'join.error.gone': 'Событие больше не доступно.',
  'join.error.name_required': 'Введите имя.',
  // Экран возврата к событию (Concept §10.1.1, DESIGN §4.11.1 — поправляет
  // §4.7): выбор сохранённой персоны вводит её комнату по сохранённому
  // токену — восстановление идентичности, без пересоздания.
  'join.import.title': 'Вернуться на событие',
  'join.import.subtitle': 'Профили, созданные на этом телефоне.',
  'join.import.return': 'Вернуться',
  'join.import.empty': 'На этом устройстве пока нет сохранённых профилей.',
  'join.import.saved_at': 'Сохранено {date}',
  'join.import.row_aria': 'Вернуться к профилю {name}',
  'join.import.dead':
    'Этот профиль больше не существует на сервере. Запись останется в списке, но вернуться в это событие нельзя.',
  'join.error.invite': 'Код приглашения недействителен или истёк.',
  'join.resume.title': 'Продолжить в «{room}»',
  'join.resume.another': 'Присоединиться к другому событию',

  /* --- camera scanner --- */
  'scan.title': 'Сканировать QR',
  'scan.close': 'Закрыть сканер',
  'scan.hint.join': 'Наведите камеру на QR-код приглашения',
  'scan.hint.person': 'Наведите камеру на QR-код на карточке участника',
  'scan.permission.intro': 'Для сканирования нужен доступ к камере.',
  'scan.turn_on': 'Включить камеру',
  'scan.permission.denied':
    'Доступ к камере запрещён. Разрешите его в настройках браузера — или введите код вручную.',
  'scan.try_again': 'Попробовать снова',
  'scan.no_camera': 'Камера недоступна на этом устройстве.',
  'scan.insecure': 'Откройте сайт по HTTPS, чтобы включить камеру.',
  'scan.fallback.enter_code': 'Ввести код вручную',
  'scan.fallback.find_list': 'Найти в списке',
  'scan.again': 'Сканировать снова',
  'scan.invalid_qr': 'Это не QR-код bleak-web.',
  'scan.code_used': 'Код уже использован — попросите обновить QR на карточке.',
  'scan.own_qr': 'Это ваш собственный QR — покажите его кому-нибудь другому.',
  'scan.foreign_persona': 'Этот профиль из другого события.',
  'scan.confirm.title': 'Отправить взаимные хендшейки и запустить агентов?',
  'scan.confirm.cta': 'Обменяться рукопожатиями',
  'scan.confirm.cancel': 'Отмена',
  'scan.error.network': 'Нет связи. Проверьте Wi-Fi.',
  'scan.aria': 'Сканер QR-кодов',
  'scan.placeholder': 'Сканер появится в следующей задаче сборки.',

  /* --- room radar --- */
  'room.title': 'Рядом со мной',
  'room.subtitle': 'Участники рядом в этой комнате.',
  'room.around': '{n} вокруг вас',
  'room.scan.open': 'Сканировать QR профиля',
  'room.empty': 'Пока никого. Попросите код приглашения у хоста — или сами поделитесь им.',
  'room.members_more': '+{n} ещё',
  'room.node.chat': '{name} — агенты уже общаются',
  'room.node.incoming': '{name} — добавил вас',
  'room.node.outgoing': '{name} — хендшейк отправлен',
  'room.node.none': '{name} — хендшейк ещё не отправлен',

  /* --- handshake states --- */
  'hs.send': 'Отправить хендшейк',
  'hs.sent': 'Хендшейк отправлен',
  'hs.waiting': 'Хендшейк отправлен — ждём ответа',
  'hs.back': 'Ответить хендшейком',
  'hs.added_you': 'Добавил вас',
  'hs.chatting': 'Общаемся',
  'hs.agents_talking': 'Агенты уже общаются',
  'hs.open_dialog': 'Открыть диалог',
  'hs.income_limit': 'Лимит исходящих хендшейков — сначала получите рукопожатия в ответ.',
  'hs.error.network': 'Нет связи. Проверьте Wi-Fi.',

  /* --- people --- */
  'people.title': 'Люди',
  'people.subtitle': 'Все участники комнаты.',
  'people.empty': 'Комната пока пуста.',
  'people.search.placeholder': 'Поиск по имени или био…',
  'people.empty_search': 'Никого не найдено по «{q}»',
  'people.reset': 'Сбросить',
  'people.search.label': 'Поиск участников',
  'people.action.send': 'Отправить хендшейк {name}',
  'people.dismiss': 'Закрыть',
  // §4.15.4.3 (Concept §19.3): «handshake back» → «handshake!» — копия
  // кнопки ответа хендшейком; «chatting»-бейдж заменён кнопкой «Открыть
  // чат» (ведёт в существующий диалог, как убранная иконка).
  'people.action.back': 'Привет!',
  'people.action.open_chat': 'Открыть чат',

  /* --- chats --- */
  'chats.title': 'Диалоги',
  'chats.subtitle': 'Здесь общаются ваши агенты',
  'chats.empty': 'Диалогов пока нет. Взаимный хендшейк запускает разговор агентов.',
  'chats.find_people': 'Найти людей',
  // §4.11.5–7 (Concept §10.1.5–7): тема ушла из элемента списка; в
  // доступном имени — статус диалога (иконка справа).
  'chats.card.aria': 'Диалог с {name} · {status}',
  'chats.status.active': 'активен',
  'chats.status.finished': 'завершён',
  'chat.warming_up': 'Агенты готовятся…',
  // §8.1.9: kickoff left the attendee dialog view; the confirm copy stays
  // (host drill-down kickoff uses it — MemberDrillDown).
  'chat.kickoff.confirm_title': 'Начать разговор заново?',
  'chat.kickoff.confirm_body':
    'История диалога будет очищена, и агенты начнут сначала. Первым говорит отправитель самого раннего хендшейка.',
  'chat.kickoff.confirm_run': 'Запустить',
  'chat.contact_stub': 'Поделиться контактом — скоро',
  // §4.13.3 contact share (Concept §13.1.3): the dialog footer's slide
  // control + the local contact-card field + the received list.
  'chat.contact_share.label': 'Свайп вправо — поделиться контактом',
  'chat.contact_share.shared': 'Контакт уже передан',
  // §4.15.C-8/§4.15.E (Concept §15.3): the SHEET-variant slide's copy —
  // «Смахните, чтобы поделиться» + текст после завершения жеста; метка 409
  // «уже передано» остаётся выше без изменений (reused unchanged).
  'chat.contact_share.sheet_label': 'Смахните, чтобы поделиться',
  'chat.contact_share.shared_done': 'Контакт отправлен!',
  'chat.contact_share.locked': 'Станет доступно, когда диалог завершится',
  'chat.contact_share.no_card': 'Добавьте контактную карточку в настройках профиля',
  'chat.contact_share.error': 'Не удалось передать контакт — попробуйте ещё раз.',
  // §4.13.5 summary sheet (Concept §13.1.5): метки чек-листа приходят с
  // сервера на английском и показываются как есть — локализуются только
  // заголовки и доступные имена.
  'chat.summary.title': 'Итоги встречи',
  'chat.summary.checklist': 'Сетевой чек-лист',
  'chat.summary.score.aria': 'Совпадение: {score} из 100',
  'chat.summary.loading': 'Считаем итог диалога…',
  // §4.15.B/E (Concept §15.2): кнопка итогов в футере — активная («Итоги
  // встречи») снова открывает шторку; неактивная показывает фразу
  // «диалог ещё идёт».
  'chat.summary.open': 'Итоги встречи',
  'chat.summary.open.disabled': 'Диалог ещё идёт',
  // §4.15.C-5/C-6 (Concept §15.3): подпись под своей рамкой аватара и метки
  // уровней совпадения (пороги 80/50 по решению владельца, 2026-11-20).
  'chat.summary.me': 'Вы',
  'chat.summary.tier.great': 'Отличное совпадение',
  'chat.summary.tier.good': 'Хороший разговор',
  'chat.summary.tier.low': 'Разные вибрации',
  'profile.contact.edit': 'Контактная карточка',
  'profile.contact.label': 'Ваша контактная карточка',
  'profile.contact.note':
    'Например: telegram: @handle. Видят только те, кому вы её передадите.',
  // §4.14.2 contacts footer page (Concept §14.1.2): вкладка «Контакты» —
  // основная поверхность «поделились с вами»; минимальный список в
  // настройках (§4.13.3) заменён ею (ключи retired вместе со списком).
  'contacts.title': 'Контакты',
  'contacts.subtitle': 'Контактами с вами поделились',
  'contacts.empty': 'Пока никто не поделился с вами контактом.',
  'chat.not_found': 'Диалог не найден — возможно, он был удалён.',
  'chat.back_to_list': 'К списку диалогов',
  'chat.scroll_bottom': 'К последним сообщениям',
  'chat.new_message': 'Новое сообщение от {name}',
  'chat.host_view': 'Наблюдение хоста',

  /* --- profile --- */
  'profile.title': 'Профиль',
  'profile.subtitle': 'Ваш профиль в этой комнате.',
  'profile.language.meta': 'Язык агента: {language}',
  'profile.greeting.caption': 'Открывает каждый новый диалог агента',
  'profile.greeting.rule':
    'Приветствие открывает каждый новый диалог. Без вопросов — только утверждения.',
  'profile.greeting.no_questions':
    'Уберите вопросительные знаки — приветствие не может содержать вопросов.',
  'profile.greeting.label': 'Приветствие',
  'profile.greeting.counter': '{n}/255',
  'profile.greeting.edit': 'Приветствие',
  'profile.greeting.regenerate': 'Сгенерировать заново',
  'profile.persona.edit': 'Профиль',
  'profile.badge.about': 'О себе',
  'profile.badge.for_agent': 'Для агента',
  'profile.private_bio.caption': 'видно только вашему агенту',
  'profile.interests.title': 'Интересы',
  'profile.interests.edit': 'Интересы',
  'profile.interests.add': 'Добавить интересы',
  'profile.interests.done': 'Готово',
  // §4.13.1: пикер пишет в РЕАЛЬНЫЕ эндпоинты интересов (зеркало локально —
  // у API нет GET-эндпоинта интересов).
  'profile.interests.note':
    'Выберите до 50 интересов — они сохранятся в вашем профиле и появятся на бейдже.',
  'profile.interests.error': 'Не удалось сохранить интересы — попробуйте ещё раз.',
  'profile.interests.empty': 'Интересы не выбраны',

  // §4.13.1 названия каталога (group → key → emoji в модуле каталога;
  // ключи использует apps/web/src/lib/interests/catalog.ts).
  'interests.group.0': 'Еда и напитки',
  'interests.group.1': 'Искусство',
  'interests.group.2': 'Спорт',
  'interests.group.3': 'Технологии',
  'interests.group.4': 'Путешествия',
  'interests.k1': 'Кофе',
  'interests.k2': 'Чай',
  'interests.k3': 'Кулинария',
  'interests.k4': 'Вино',
  'interests.k5': 'Сладости',
  'interests.k6': 'Музыка',
  'interests.k7': 'Искусство',
  'interests.k8': 'Фото',
  'interests.k9': 'Кино',
  'interests.k10': 'Книги',
  'interests.k11': 'Спорт',
  'interests.k12': 'Бег',
  'interests.k13': 'Велосипед',
  'interests.k14': 'Походы',
  'interests.k15': 'Йога',
  'interests.k16': 'Технологии',
  'interests.k17': 'Игры',
  'interests.k18': 'Наука',
  'interests.k19': 'Роботы',
  'interests.k20': 'ИИ',
  'interests.k21': 'Путешествия',
  'interests.k22': 'Автомобили',
  'interests.k23': 'Кемпинг',
  'interests.k24': 'Море',
  'interests.k25': 'Города',
  // §8.1.5: ровно три метрики — «Отправлено» (б. «Хендшейки»),
  // «Добавили вас», «В диалогах» (б. «Диалоги»).
  'profile.stats.handshakes_label': 'Отправлено',
  'profile.stats.dialogs_label': 'В диалогах',
  'profile.stats.added_label': 'Добавили вас',
  'profile.stats.handshakes': 'Отправлено {n}',
  'profile.stats.dialogs': 'В диалогах {n}',
  'profile.qr.caption': 'Покажите, чтобы обменяться рукопожатиями',
  'profile.qr.alt': 'Личный QR-код',
  'profile.qr.onetime': 'QR одноразовый — после обмена он обновится сам.',
  'profile.qr.refreshed': 'QR обновлён',
  'profile.qr.aria': 'Ваш одноразовый QR для обмена рукопожатиями',
  'profile.saved': 'Сохранено',
  'profile.settings.title': 'Мой профиль',
  'profile.settings.persona': 'Мой профиль',
  'profile.leave': 'Выйти из комнаты',
  'profile.leave.confirm_body':
    'Вы покинете событие. Токен останется на этом устройстве — вы сможете вернуться в любой момент через «Вернуться на событие».',
  'profile.not_found': 'Профиль не найден',
  'profile.exit': 'Выйти',
  'profile.rotate.row': 'Сгенерировать новый ключ доступа',
  'profile.rotate.title': 'Сгенерировать новый ключ доступа?',
  'profile.rotate.body':
    'Текущий ключ перестанет действовать: другие устройства с этим ключом потеряют доступ к профилю.',
  'profile.rotate.cta': 'Сгенерировать',
  'profile.rotate.done': 'Ключ обновлён',

  /* --- host --- */
  'host.title': 'Хост',
  'host.subtitle': 'Создайте комнату события и поделитесь приглашением.',
  // v2-учётные данные (DESIGN rev. 3 §3.7): гейт одноразового токена создания —
  // переименованные ключи host.gate.*; остатки host.token.* уберёт TZ2-11.
  'host.gate.label': 'Токен создания комнаты',
  'host.gate.continue': 'Продолжить',
  'host.gate.note':
    'Одноразовый токен выдаёт оператор развертывания. После создания комнаты он больше не нужен и не сохраняется.',
  'host.session_reset': 'Доступ к комнате отозван — войдите заново с токеном создания.',
  'host.token.rejected': 'Токен отклонён.',
  'host.form.name': 'Название',
  'host.form.description': 'Описание',
  'host.form.language': 'Язык агентов',
  'host.create': 'Создать комнату',
  'host.join_attendee': 'Присоединиться как участник',
  'host.create_another': 'Создать другую комнату',
  'host.stats.members': 'Участники {n}/{max}',
  'host.stats.language': 'Язык {language}',
  'host.empty_live': 'Пока никто не присоединился.',
  'host.delete_room': 'Удалить комнату',
  'host.delete_warning': 'Комната будет удалена вместе со всеми участниками.',
  'host.room_deleted': 'Комната удалена.',
  'host.code.label': 'Код приглашения',
  'host.code.aria': 'Код: {code}',
  'host.qr.alt': 'QR-код приглашения',
  'host.invite_link': 'Ссылка-приглашение',
  'host.settings.title': 'Настройки комнаты',
  'host.danger.title': 'Опасная зона',
  'host.stats.members_only': 'Участники',
  'host.stats.language_only': 'Язык',
  'host.member.open': '{name} — открыть карточку',
  // v2-управление приглашениями + drill-down с токеном комнаты
  // (DESIGN rev. 3 §3.7, §4.7)
  'host.invites.title': 'Коды приглашения',
  'host.invites.hint': 'Код действует до истечения срока; отозвать можно в любой момент.',
  'host.invites.mint': 'Выпустить код',
  'host.invites.preset.1h': '1 час',
  'host.invites.preset.24h': '24 часа',
  'host.invites.preset.7d': '7 дней',
  'host.invites.preset.custom': 'Своё время…',
  'host.invites.custom_label': 'Код истекает',
  'host.invites.expires_in': 'истекает через {time}',
  'host.invites.revoke': 'Отозвать',
  'host.invites.revoke_aria': 'Отозвать код {code}',
  'host.invites.qr_toggle': 'QR кода {code}',
  'host.invites.revoked': 'Код отозван.',
  'host.rotate_room.row': 'Сгенерировать ключ комнаты',
  'host.rotate_room.title': 'Сгенерировать ключ комнаты?',
  'host.rotate_room.body': 'Текущий ключ комнаты перестанет действовать. Продолжить?',
  'host.rotate_room.cta': 'Сгенерировать',
  'host.rotate_room.done': 'Ключ комнаты обновлён',
  'host.drill.clear': 'Очистить историю',
  'host.drill.clear_confirm': 'История диалога участников будет очищена.',
  'host.drill.empty': 'У участника пока нет диалогов.',
  'host.drill.pending_amendment':
    'Список диалогов участника появится вместе с серверным обновлением (флаг 6.9a).',
  'host.drill.kickoff': 'Запустить заново',
  'host.drill.dialogs': 'Диалоги',

  /* --- глобальный гейт 401 (DESIGN rev. 3 §2.8, §4.7) --- */
  'auth.401.notice':
    'У этого профиля нет действительного ключа доступа — присоединитесь заново по коду события.',

  /* --- common --- */
  'common.loading': 'Загрузка…',
  'common.locale': 'Язык интерфейса',
  'common.error': 'Что-то пошло не так.',
  'common.error.network': 'Нет связи. Проверьте Wi-Fi — мы продолжаем попытки.',
  'common.error.api': 'Ошибка сервера',
  'common.retry': 'Повторить',
  'common.back': 'Назад',
  'common.close': 'Закрыть',
  'common.save': 'Сохранить',
  'common.cancel': 'Отмена',
  'common.copy': 'Скопировать',
  'common.copied': 'Скопировано'
};
