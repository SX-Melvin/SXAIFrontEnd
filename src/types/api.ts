export interface CommonAPIResponse<T> {
    errorMessage?: string
    data?: T
}

export interface Pagination<T> {
    pageNumber: number
    pageSize: number
    totalPage: number
    totalRecords: number
    hasNext: boolean
    data: T[]
}