import { l as noop, s as subscribe_to_store } from "./server2.js";
// ../../node_modules/svelte/src/internal/client/reactivity/equality.js
/**
* @param {unknown} a
* @param {unknown} b
* @returns {boolean}
*/
function safe_not_equal(a, b) {
	return a != a ? b == b : a !== b || a !== null && typeof a === "object" || typeof a === "function";
}
// ../../node_modules/svelte/src/store/shared/index.js
/** @import { Readable, StartStopNotifier, Subscriber, Unsubscriber, Updater, Writable } from '../public.js' */
/** @import { Stores, StoresValues, SubscribeInvalidateTuple } from '../private.js' */
/**
* @type {Array<SubscribeInvalidateTuple<any> | any>}
*/
var subscriber_queue = [];
/**
* Create a `Writable` store that allows both updating and reading by subscription.
*
* @template T
* @param {T} [value] initial value
* @param {StartStopNotifier<T>} [start]
* @returns {Writable<T>}
*/
function writable(value, start = noop) {
	/** @type {Unsubscriber | null} */
	let stop = null;
	/** @type {Set<SubscribeInvalidateTuple<T>>} */
	const subscribers = /* @__PURE__ */ new Set();
	/**
	* @param {T} new_value
	* @returns {void}
	*/
	function set(new_value) {
		if (safe_not_equal(value, new_value)) {
			value = new_value;
			if (stop) {
				const run_queue = !subscriber_queue.length;
				for (const subscriber of subscribers) {
					subscriber[1]();
					subscriber_queue.push(subscriber, value);
				}
				if (run_queue) {
					for (let i = 0; i < subscriber_queue.length; i += 2) subscriber_queue[i][0](subscriber_queue[i + 1]);
					subscriber_queue.length = 0;
				}
			}
		}
	}
	/**
	* @param {Updater<T>} fn
	* @returns {void}
	*/
	function update(fn) {
		set(fn(value));
	}
	/**
	* @param {Subscriber<T>} run
	* @param {() => void} [invalidate]
	* @returns {Unsubscriber}
	*/
	function subscribe(run, invalidate = noop) {
		/** @type {SubscribeInvalidateTuple<T>} */
		const subscriber = [run, invalidate];
		subscribers.add(subscriber);
		if (subscribers.size === 1) stop = start(set, update) || noop;
		run(value);
		return () => {
			subscribers.delete(subscriber);
			if (subscribers.size === 0 && stop) {
				stop();
				stop = null;
			}
		};
	}
	return {
		set,
		update,
		subscribe
	};
}
/**
* Get the current value from a store by subscribing and immediately unsubscribing.
*
* @template T
* @param {Readable<T>} store
* @returns {T}
*/
function get(store) {
	let value;
	subscribe_to_store(store, (_) => value = _)();
	return value;
}
// src/lib/i18n/en.ts
/** English UI dictionary (RU primary, EN second — parity is test-enforced). */
var en = {
	"app.title": "bleak-web",
	"nav.room": "Room",
	"nav.people": "People",
	"nav.chats": "Chats",
	"nav.profile": "Profile",
	"nav.host": "Host",
	"join.title": "Join the event",
	"join.subtitle": "Enter the 6-digit invite code from the QR or the invitation.",
	"join.code.label": "Invite code",
	"join.code.placeholder": "000000",
	"join.enter": "Enter room",
	"join.error.unknown": "Unknown code — check it with the host.",
	"room.title": "Around me",
	"room.subtitle": "Attendees near you in this room.",
	"room.empty": "No one around yet.",
	"people.title": "People",
	"people.subtitle": "Everyone in the room.",
	"people.empty": "The room is empty so far.",
	"chats.title": "Chats",
	"chats.subtitle": "Dialogs of your mutual handshakes — the agents talk here.",
	"chats.empty": "No dialogs yet. Send a handshake first.",
	"profile.title": "Profile",
	"profile.subtitle": "Your persona-agent in this room.",
	"host.title": "Host",
	"host.subtitle": "Create an event room and share the invite.",
	"common.loading": "Loading…",
	"common.error": "Something went wrong.",
	"common.retry": "Retry"
};
var dictionaries = {
	ru: {
		"app.title": "bleak-web",
		"nav.room": "Рядом",
		"nav.people": "Люди",
		"nav.chats": "Диалоги",
		"nav.profile": "Профиль",
		"nav.host": "Хост",
		"join.title": "Войти на событие",
		"join.subtitle": "Введите 6-значный код приглашения с QR-кода или из приглашения.",
		"join.code.label": "Код приглашения",
		"join.code.placeholder": "000000",
		"join.enter": "Войти в комнату",
		"join.error.unknown": "Код не найден — уточните его у организатора.",
		"room.title": "Рядом со мной",
		"room.subtitle": "Участники рядом в этой комнате.",
		"room.empty": "Пока никого рядом.",
		"people.title": "Люди",
		"people.subtitle": "Все участники комнаты.",
		"people.empty": "Комната пока пуста.",
		"chats.title": "Диалоги",
		"chats.subtitle": "Диалоги взаимных хендшейков — здесь разговаривают агенты.",
		"chats.empty": "Диалогов пока нет. Сначала отправьте хендшейк.",
		"profile.title": "Профиль",
		"profile.subtitle": "Ваша персона-агент в этой комнате.",
		"host.title": "Хост",
		"host.subtitle": "Создайте комнату события и поделитесь приглашением.",
		"common.loading": "Загрузка…",
		"common.error": "Что-то пошло не так.",
		"common.retry": "Повторить"
	},
	en
};
var STORAGE_KEY = "bleak.locale";
var HTML_LANG = "lang";
function messages(locale) {
	return dictionaries[locale];
}
/** Translate with optional {placeholders}. Unknown keys fall back to the key. */
function translate(locale, key, params) {
	const template = messages(locale)[key] ?? en[key] ?? key;
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (match, name) => params[name] ?? match);
}
/** Preferred locale from persistence (localStorage), else RU. */
function storedLocale() {
	try {
		const value = localStorage.getItem(STORAGE_KEY);
		if (value === "ru" || value === "en") return value;
	} catch {}
	return "ru";
}
function applyDocumentLang(locale) {
	document.documentElement.setAttribute(HTML_LANG, locale);
}
// src/lib/i18n/locale.ts
/**
* Locale store: persisted preference, RU default, document.lang sync.
* Classic writable store (works in Svelte 5, testable without the compiler).
*/
var locale = writable("ru");
/** Initialize from persistence; call once from the root layout. */
function initLocale() {
	const stored = storedLocale();
	locale.set(stored);
	applyDocumentLang(stored);
}
/** Reactive translate helper: use $locale + t('key') in components. */
function t(key, params) {
	return translate(get(locale), key, params);
}
export { t as n, writable as r, initLocale as t };

//# sourceMappingURL=locale.js.map