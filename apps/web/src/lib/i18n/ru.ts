import type { MessageKey } from './en';

/**
 * Russian UI dictionary — primary UI language (Concept §2).
 * Copy source: docs/DESIGN.md §4.7 (owner-approved) — strings are verbatim;
 * keys must match en.ts exactly (parity is CI-enforced).
 */
export const ru: Record<MessageKey, string> = {
  /* --- shell / navigation --- */
  'app.title': 'bleak-web',
  'nav.room': 'Рядом',
  'nav.people': 'Люди',
  'nav.chats': 'Диалоги',
  'nav.profile': 'Профиль',
  'nav.host': 'Хост',
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
  'join.create_persona': 'Создать персону',
  'join.import': 'Импортировать из прошлого события',
  'join.import.notice': 'Персона будет скопирована в это событие',
  'join.change_code': 'Изменить код',
  'join.form.name': 'Имя',
  'join.form.public_bio': 'Кто вы — увидят другие',
  'join.form.private_bio': 'Только для вашего агента',
  'join.error.name_taken': 'Такое имя в комнате уже занято.',
  'join.error.gone': 'Событие больше не доступно.',
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
  'scan.own_qr': 'Это ваш собственный QR — покажите его кому-нибудь другому.',
  'scan.foreign_persona': 'Эта персона из другого события.',
  'scan.confirm.title': 'Отправить взаимные хендшейки и запустить агентов?',
  'scan.confirm.cta': 'Обменяться рукопожатиями',
  'scan.confirm.cancel': 'Отмена',
  'scan.error.network': 'Нет связи. Проверьте Wi-Fi.',

  /* --- room radar --- */
  'room.title': 'Рядом со мной',
  'room.subtitle': 'Участники рядом в этой комнате.',
  'room.around': '{n} вокруг вас',
  'room.scan.open': 'Сканировать QR персоны',
  'room.empty': 'Пока никого. Попросите код приглашения у хоста — или сами поделитесь им.',
  'room.members_more': '+{n} ещё',

  /* --- handshake states --- */
  'hs.send': 'Отправить хендшейк',
  'hs.sent': 'Хендшейк отправлен',
  'hs.waiting': 'Хендшейк отправлен — ждём ответа',
  'hs.back': 'Ответить хендшейком',
  'hs.added_you': 'Добавил вас',
  'hs.chatting': 'Общаемся',
  'hs.agents_talking': 'Агенты уже общаются',
  'hs.open_dialog': 'Открыть диалог',

  /* --- people --- */
  'people.title': 'Люди',
  'people.subtitle': 'Все участники комнаты.',
  'people.empty': 'Комната пока пуста.',
  'people.search.placeholder': 'Поиск по имени или био…',
  'people.filter.all': 'Все',
  'people.filter.sent': 'Отправлены',
  'people.filter.added': 'Добавили вас',
  'people.filter.chatting': 'Общаемся',
  'people.empty_search': 'Никого не найдено по «{q}»',
  'people.reset': 'Сбросить',

  /* --- chats --- */
  'chats.title': 'Диалоги',
  'chats.subtitle': 'Здесь общаются ваши агенты',
  'chats.empty': 'Диалогов пока нет. Взаимный хендшейк запускает разговор агентов.',
  'chats.find_people': 'Найти людей',
  'chat.warming_up': 'Агенты готовятся…',
  'chat.kickoff': 'Запустить диалог заново',
  'chat.kickoff.confirm_title': 'Начать разговор заново?',
  'chat.kickoff.confirm_body':
    'История диалога будет очищена, и агенты начнут сначала. Первым говорит отправитель самого раннего хендшейка.',
  'chat.kickoff.confirm_run': 'Запустить',
  'chat.kickoff.speaker': 'Первым говорит {name}',
  'chat.contact_stub': 'Поделиться контактом — скоро',
  'chat.not_found': 'Диалог не найден — возможно, он был удалён.',

  /* --- profile --- */
  'profile.title': 'Профиль',
  'profile.subtitle': 'Ваша персона-агент в этой комнате.',
  'profile.language.meta': 'Язык агента: {language}',
  'profile.greeting.caption': 'Открывает каждый новый диалог агента',
  'profile.greeting.rule':
    'Приветствие открывает каждый новый диалог. Без вопросов — только утверждения.',
  'profile.greeting.no_questions':
    'Уберите вопросительные знаки — приветствие не может содержать вопросов.',
  'profile.badge.about': 'О себе',
  'profile.badge.for_agent': 'Для агента',
  'profile.private_bio.caption': 'видно только вашему агенту',
  'profile.interests.empty': 'Интересы не выбраны',
  'profile.stats.handshakes': 'Хендшейки {n}',
  'profile.stats.dialogs': 'Диалоги {n}',
  'profile.qr.caption': 'Покажите, чтобы обменяться рукопожатиями',
  'profile.leave': 'Выйти из комнаты',
  'profile.leave.confirm_body':
    'Ваша персона будет удалена из комнаты вместе с хендшейками и диалогами.',
  'profile.not_found': 'Персона не найдена',
  'profile.exit': 'Выйти',

  /* --- host --- */
  'host.title': 'Хост',
  'host.subtitle': 'Создайте комнату события и поделитесь приглашением.',
  'host.token.label': 'Токен хоста',
  'host.token.rejected': 'Токен отклонён.',
  'host.token.forget': 'Забыть токен',
  'host.token.note': 'Токен выдаётся владельцем развертывания.',
  'host.token.continue': 'Продолжить',
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

  /* --- common --- */
  'common.loading': 'Загрузка…',
  'common.error': 'Что-то пошло не так.',
  'common.error.network': 'Нет связи. Проверьте Wi-Fi — мы продолжаем попытки.',
  'common.error.api': 'Ошибка сервера',
  'common.retry': 'Повторить',
  'common.back': 'Назад',
  'common.save': 'Сохранить',
  'common.cancel': 'Отмена',
  'common.copy': 'Скопировать',
  'common.copied': 'Скопировано'
};
