import { UserInfo } from "../services/auth";

export function getUserInfo(): UserInfo | null {
    const userInfoStr = localStorage.getItem('user');
    return userInfoStr ? JSON.parse(userInfoStr) : null;
}