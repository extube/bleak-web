import "../../../chunks/server2.js";
import { n as t } from "../../../chunks/locale.js";
import { t as PagePlaceholder } from "../../../chunks/PagePlaceholder.js";
// src/routes/profile/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		PagePlaceholder($$renderer, {
			title: t("profile.title"),
			subtitle: t("profile.subtitle"),
			note: "Greeting editing, bios, mock interests and locale switch land here."
		});
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map