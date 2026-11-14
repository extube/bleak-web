import type { MessageKey } from './en';

/** Russian UI dictionary — primary UI language. Keys must match en (tested). */
export const ru: Record<MessageKey, string> = {
  'app.title': 'bleak-web',
  'nav.room': 'Рядом',
  'nav.people': 'Люди',
  'nav.chats': 'Диалоги',
  'nav.profile': 'Профиль',
  'nav.host': 'Хост',
  'join.title': 'Войти на событие',
  'join.subtitle': 'Введите 6-значный код приглашения с QR-кода или из приглашения.',
  'join.code.label': 'Код приглашения',
  'join.code.placeholder': '000000',
  'join.enter': 'Войти в комнату',
  'join.error.unknown': 'Код не найден — уточните его у организатора.',
  'room.title': 'Рядом со мной',
  'room.subtitle': 'Участники рядом в этой комнате.',
  'room.empty': 'Пока никого рядом.',
  'people.title': 'Люди',
  'people.subtitle': 'Все участники комнаты.',
  'people.empty': 'Комната пока пуста.',
  'chats.title': 'Диалоги',
  'chats.subtitle': 'Диалоги взаимных хендшейков — здесь разговаривают агенты.',
  'chats.empty': 'Диалогов пока нет. Сначала отправьте хендшейк.',
  'profile.title': 'Профиль',
  'profile.subtitle': 'Ваша персона-агент в этой комнате.',
  'host.title': 'Хост',
  'host.subtitle': 'Создайте комнату события и поделитесь приглашением.',
  'common.loading': 'Загрузка…',
  'common.error': 'Что-то пошло не так.',
  'common.retry': 'Повторить'
};
