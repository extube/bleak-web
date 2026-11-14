import { u as escape_html } from "./server2.js";
// src/lib/components/PagePlaceholder.svelte
function PagePlaceholder($$renderer, $$props) {
	/** Scaffold placeholder for feature pages — replaced by design/worker phase. */
	let { title, subtitle, note } = $$props;
	$$renderer.push(`<main class="page svelte-kfiwdk"><header><h1 class="svelte-kfiwdk">${escape_html(title)}</h1> `);
	if (subtitle) $$renderer.push(`<!--[0--><p class="subtitle svelte-kfiwdk">${escape_html(subtitle)}</p>`);
	else $$renderer.push("<!--[-1-->");
	$$renderer.push(`<!--]--></header> `);
	if (note) $$renderer.push(`<!--[0--><p class="note svelte-kfiwdk">${escape_html(note)}</p>`);
	else $$renderer.push("<!--[-1-->");
	$$renderer.push(`<!--]--></main>`);
}
export { PagePlaceholder as t };

//# sourceMappingURL=PagePlaceholder.js.map