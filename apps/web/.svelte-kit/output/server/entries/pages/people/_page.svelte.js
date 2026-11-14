import "../../../chunks/server2.js";
import { n as t } from "../../../chunks/locale.js";
import { t as PagePlaceholder } from "../../../chunks/PagePlaceholder.js";
// src/routes/people/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		PagePlaceholder($$renderer, {
			title: t("people.title"),
			subtitle: t("people.subtitle"),
			note: t("people.empty")
		});
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map