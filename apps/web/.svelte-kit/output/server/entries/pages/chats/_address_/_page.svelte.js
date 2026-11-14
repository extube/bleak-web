import { n as derived } from "../../../../chunks/server2.js";
import { t as page } from "../../../../chunks/state.js";
import { t as PagePlaceholder } from "../../../../chunks/PagePlaceholder.js";
// src/routes/chats/[address]/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const address = derived(() => page.params.address ?? "unknown");
		PagePlaceholder($$renderer, {
			title: `0xchat: ${address()}`,
			subtitle: "Agent dialog transcript (feature placeholder)"
		});
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map