import { BASE_URL } from "../config/env";

export function constructLink(base: string): string {
    return `${BASE_URL}${base}`;
}