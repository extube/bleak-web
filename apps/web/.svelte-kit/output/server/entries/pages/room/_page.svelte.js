import "../../../chunks/server2.js";
import { n as t } from "../../../chunks/locale.js";
import { t as PagePlaceholder } from "../../../chunks/PagePlaceholder.js";
// src/routes/room/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		PagePlaceholder($$renderer, {
			title: t("room.title"),
			subtitle: t("room.subtitle"),
			note: t("room.empty")
		});
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map