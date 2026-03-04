import { BASE_API_URL } from "../config/env"
import { CommonAPIResponse, Pagination } from "../types/api"
import backendApi from "./backend_api"

export interface CSNode {
    parentID: number
    dataID: number
    subType: number
    deleted: number
    versionNum: number
    name: string
}

export async function getFolders(
    name: string | null = null,
    page = 1,
    limit = 50
): Promise<CommonAPIResponse<Pagination<CSNode>>> {
    let url = `${BASE_API_URL}/api/cs/nodes/folders?page=${page}&limit=${limit}`
    if(name) {
        url += `&name=${encodeURIComponent(name)}`
    }
    const req = await backendApi<CommonAPIResponse<Pagination<CSNode>>>(url, {
        method: 'GET',
    });

    return req.data;
}