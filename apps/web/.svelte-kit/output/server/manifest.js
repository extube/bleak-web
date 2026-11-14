export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	app_dir: "_app",
	app_path: "_app",
	assets: new Set(["favicon.svg","icons/icon.svg","manifest.webmanifest"]),
	mime_types: {".svg":"image/svg+xml",".webmanifest":"application/manifest+json"},
	client: {start:"_app/immutable/entry/start.DTWZCsLy.js",app:"_app/immutable/entry/app.CG_2wCnm.js",imports:["_app/immutable/entry/start.DTWZCsLy.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/DclECHGd.js","_app/immutable/chunks/BXi1_5dw.js","_app/immutable/chunks/w-ghWgbq.js","_app/immutable/chunks/6sCW3_qm.js","_app/immutable/chunks/TUjXw4LB.js","_app/immutable/entry/app.CG_2wCnm.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
	
	nodes: [
		__memo(() => import('./nodes/0.js')),
		__memo(() => import('./nodes/1.js')),
		__memo(() => import('./nodes/2.js')),
		__memo(() => import('./nodes/3.js')),
		__memo(() => import('./nodes/4.js')),
		__memo(() => import('./nodes/5.js')),
		__memo(() => import('./nodes/6.js')),
		__memo(() => import('./nodes/7.js')),
		__memo(() => import('./nodes/8.js'))
	],
	remotes: {
		
	},
	routes: [
		{
			id: "/",
			pattern: /^\/$/,
			params: [],
			page: { layouts: [0,], errors: [1,], leaf: 2 },
			endpoint: null
		},
		{
			id: "/chats",
			pattern: /^\/chats\/?$/,
			params: [],
			page: { layouts: [0,], errors: [1,], leaf: 3 },
			endpoint: null
		},
		{
			id: "/chats/[address]",
			pattern: /^\/chats\/([^/]+?)\/?$/,
			params: [{"name":"address","optional":false,"rest":false,"chained":false}],
			page: { layouts: [0,], errors: [1,], leaf: 4 },
			endpoint: null
		},
		{
			id: "/host",
			pattern: /^\/host\/?$/,
			params: [],
			page: { layouts: [0,], errors: [1,], leaf: 5 },
			endpoint: null
		},
		{
			id: "/people",
			pattern: /^\/people\/?$/,
			params: [],
			page: { layouts: [0,], errors: [1,], leaf: 6 },
			endpoint: null
		},
		{
			id: "/profile",
			pattern: /^\/profile\/?$/,
			params: [],
			page: { layouts: [0,], errors: [1,], leaf: 7 },
			endpoint: null
		},
		{
			id: "/room",
			pattern: /^\/room\/?$/,
			params: [],
			page: { layouts: [0,], errors: [1,], leaf: 8 },
			endpoint: null
		}
	],
	prerendered_routes: new Set([]),
	matchers: async () => {
		return {};
	},
	server_assets: {}
}
})();
