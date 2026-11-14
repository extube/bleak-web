import { c as attr, u as escape_html } from "../../chunks/server2.js";
import { t as page } from "../../chunks/state.js";
import "../../chunks/navigation.js";
import "../../chunks/paths.js";
import { n as t } from "../../chunks/locale.js";
// src/lib/join.ts
/** Join-flow helpers shared by the join screen and the room resolver. */
var CODE_PATTERN = /^\d{6}$/;
/** The 6-digit invite code is not the room address (Concept §1). */
function isValidInviteCode(code) {
	return CODE_PATTERN.test(code);
}
// src/routes/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let code = "";
		const urlCode = page.url.searchParams.get("code");
		if (urlCode && isValidInviteCode(urlCode)) code = urlCode;
		$$renderer.push(`<main class="join svelte-1uha8ag"><h1 class="logo pixel-corners svelte-1uha8ag">${escape_html(t("app.title"))}</h1> <h2>${escape_html(t("join.title"))}</h2> <p class="subtitle svelte-1uha8ag">${escape_html(t("join.subtitle"))}</p> <form><label for="invite-code" class="svelte-1uha8ag">${escape_html(t("join.code.label"))}</label> <input id="invite-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6"${attr("placeholder", t("join.code.placeholder"))}${attr("value", code)} required="" class="svelte-1uha8ag"/> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <button type="submit" class="cta">${escape_html(t("join.enter"))}</button></form></main>`);
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map