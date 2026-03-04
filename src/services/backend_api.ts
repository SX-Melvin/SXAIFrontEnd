import axios from "axios";
import { ACCESS_TOKEN_KEY } from "../config/key";
import { refreshAccessToken } from "./auth";

const backendApi = axios.create({
  timeout: 100000,
  headers: {
    Accept: "application/x-www-form-urlencoded",
  },
});

backendApi.interceptors.request.use(
  (config) => {
    config.headers['ngrok-skip-browser-warning'] = "1";
    config.headers['Authorization'] = "Bearer " + localStorage.getItem(ACCESS_TOKEN_KEY);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

backendApi.interceptors.response.use(
  async (response) => {
    return response;
  },
  async (error) => {
    try {
        const status = error?.response?.status;

      if (status === 401) {
        const refreshToken = await refreshAccessToken();
        if(refreshToken == null) {
          return Promise.reject(error);
        }
        return backendApi(error.config);
      }

      return Promise.reject(error);
    } catch (error) {
      return Promise.reject(error);
    }
  }
);

export default backendApi;