import { u as escape_html } from "../../chunks/server2.js";
import { t as page } from "../../chunks/state.js";
// src/routes/+error.svelte
function _error($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		$$renderer.push(`<main class="error svelte-1j96wlh"><h1>${escape_html(page.status)}</h1> <p>${escape_html(page.error?.message ?? "Unexpected error")}</p></main>`);
	});
}
export { _error as default };

//# sourceMappingURL=_error.svelte.js.map