import "../../../chunks/server2.js";
import { n as t } from "../../../chunks/locale.js";
import { t as PagePlaceholder } from "../../../chunks/PagePlaceholder.js";
// src/routes/host/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		PagePlaceholder($$renderer, {
			title: t("host.title"),
			subtitle: t("host.subtitle"),
			note: "Room creation via the helper (host token), QR/code sharing, live monitor."
		});
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map