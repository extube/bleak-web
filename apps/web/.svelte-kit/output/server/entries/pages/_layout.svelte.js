import { Ct as resolve } from "../../chunks/internal.js";
import { c as attr, i as head, n as derived, r as ensure_array_like, t as attr_class, u as escape_html } from "../../chunks/server2.js";
import { t as page } from "../../chunks/state.js";
import { n as t, r as writable } from "../../chunks/locale.js";
import "../../chunks/paths.js";
writable(null);
// src/lib/components/TabBar.svelte
function TabBar($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const tabs = derived(() => [
			{
				route: "/room",
				label: t("nav.room"),
				icon: "◉",
				active: page.url.pathname.startsWith("/room")
			},
			{
				route: "/people",
				label: t("nav.people"),
				icon: "☺",
				active: page.url.pathname.startsWith("/people")
			},
			{
				route: "/chats",
				label: t("nav.chats"),
				icon: "▤",
				active: page.url.pathname.startsWith("/chats")
			},
			{
				route: "/profile",
				label: t("nav.profile"),
				icon: "☾",
				active: page.url.pathname.startsWith("/profile")
			},
			{
				route: "/host",
				label: t("nav.host"),
				icon: "★",
				active: page.url.pathname.startsWith("/host")
			}
		]);
		$$renderer.push(`<nav class="tabbar pixel-corners svelte-1wwzsr0" aria-label="main"><!--[-->`);
		const each_array = ensure_array_like(tabs());
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let tab = each_array[$$index];
			$$renderer.push(`<a${attr("href", resolve(tab.route))}${attr("aria-current", tab.active ? "page" : void 0)}${attr_class("svelte-1wwzsr0", void 0, { "active": tab.active })}><span class="icon svelte-1wwzsr0" aria-hidden="true">${escape_html(tab.icon)}</span> <span class="label">${escape_html(tab.label)}</span></a>`);
		}
		$$renderer.push(`<!--]--></nav>`);
	});
}
// src/routes/+layout.svelte
function _layout($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { children } = $$props;
		const isJoin = derived(() => page.url.pathname === "/");
		head("12qhfyh", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>bleak-web</title>`);
			});
		});
		$$renderer.push(`<div class="app-shell svelte-12qhfyh">`);
		children($$renderer);
		$$renderer.push(`<!----> `);
		if (!isJoin()) {
			$$renderer.push("<!--[0-->");
			TabBar($$renderer, {});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
	});
}
export { _layout as default };

//# sourceMappingURL=_layout.svelte.js.map