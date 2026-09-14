// One GET, recorded and checked the same way on every page script.

import { check } from "k6";
import http from "k6/http";
import { record } from "./record.js";
import { withSourceIpHeaders } from "./source-ip.js";
import { TARGET_URL } from "./target.js";

export function getPage(path, scenario) {
	const res = http.get(`${TARGET_URL}${path}`, {
		headers: withSourceIpHeaders(__VU),
		tags: { name: path },
	});
	record(res, { scenario, endpoint: path });
	check(res, { "status 200": (r) => r.status === 200 });
	return res;
}

export function requiredEnv(name) {
	const value = __ENV[name];
	if (!value) {
		throw new Error(`REFUSED — ${name} is not set`);
	}
	return value;
}
